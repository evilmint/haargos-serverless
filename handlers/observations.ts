import { PutCommand, QueryCommandOutput } from '@aws-sdk/lib-dynamodb';
import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 } from 'uuid';
import { environmentSchema, observationSchema } from '../lib/yup/observation-schema';
import { dynamoDbClient } from '../dependencies/dynamodb';
import { getObservations } from '../services/observation-service';
import {
  checkInstallation,
  updateInstallationAgentData,
} from '../services/installation-service';
import { BaseRequest } from '../lib/base-request';
import { NextFunction, Response } from 'express';
import { InferType } from 'yup';

async function GetObservationsHandler(
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const installationId = req.query.installation_id ?? '0';
    const isInstallationValid = await checkInstallation(req.user.userId, installationId);

    if (!isInstallationValid) {
      return res.status(400).json({ error: 'Invalid installation.' });
    }

    const fetchLimit = Number(process.env.RETURN_OBSERVATION_COUNT);
    const response = await getObservations(req.user.userId, installationId, 'descending', fetchLimit);

    return res.status(200).json({ body: { items: response.Items } });
  } catch (error) {
    return res.status(500).json({ error: error });
  }
}

function chunkArray(array: any[], chunkSize: number) {
  let chunks: any[] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function PostObservationsHandler(
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    if (!req.agentToken) {
      return res.status(400).json({ error: 'Bad request' });
    }

    const userId = req.agentToken['user_id'];

    req.body.installation_id = req.agentToken['installation_id'];

    let requestData = req.body;
    requestData.userId = userId;

    const isInstallationValid = await checkInstallation(
      userId,
      req.agentToken['installation_id'],
    );

    if (!isInstallationValid) {
      return res.status(400).json({ error: 'Invalid installation.' });
    }

    try {
      await observationSchema.validate(req.body, { abortEarly: true });
    } catch (error) {
      if (req.IN_DEV_STAGE) {
        return res.status(400).json({ error: error });
      } else {
        return res.status(400).json({ error: 'Bad request' });
      }
    }

    requestData.timestamp = new Date().toISOString();
    requestData.dangers = createDangers(req.body.environment, req.body.logs);

    const params = {
      TableName: process.env.OBSERVATION_TABLE,
      Item: { id: v4(), ...requestData },
    };

    try {

      // Query for all the observations
      const allObservations = await getObservations(
        userId,
        req.agentToken['installation_id'],
        'ascending',
        1000,
      );
      const sortedObservations = (allObservations.Items ?? []).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      const keepObservationCount = Number(process.env.MAX_OBSERVATIONS_KEPT ?? '0');
      // Check if we need to delete any old observations
      if (sortedObservations.length > keepObservationCount) {
        const itemsToDelete = sortedObservations
          .slice(keepObservationCount- 1)
          .map(observation => {
            return {
              DeleteRequest: {
                Key: {
                  userId: { S: observation.userId },
                  timestamp: { S: observation.timestamp },
                },
              },
            };
          });

        const maxBatchItemSize = 25; // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html
        const chunksOfItemsToDelete = chunkArray(itemsToDelete, maxBatchItemSize);
        for (const chunk of chunksOfItemsToDelete) {
          const batchDeleteParams = {
            RequestItems: {
              [String(process.env.OBSERVATION_TABLE)]: chunk,
            },
          };

          await dynamoDbClient.send(new BatchWriteItemCommand(batchDeleteParams));
        }
      }
  
      await dynamoDbClient.send(new PutCommand(params));

      await updateInstallationAgentData(
        userId,
        requestData.installation_id,
        requestData.dangers,
      );

      return res.json({ status: 200 });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error });
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = error.errors; // TODO: Don't print when not in debug

      if (req.IN_DEV_STAGE) {
        return res.status(400).json({ error: validationErrors });
      } else {
        return res.status(400).json({ error: 'Bad request' });
      }
    } else {
      // Other unexpected errors
      console.error(error);
      return res
        .status(500)
        .json({ error: 'Could not insert observation data [error=' + error + '].' });
    }
  }
}

function createDangers(environment: InferType<typeof environmentSchema>, logs) {
  let dangers: string[] = [];
  const volumeUsagePercentage = environment.storage.reduce((highest, current) => {
    const cur = parseInt(current.use_percentage.slice(0, -1));
    return cur > highest ? cur : highest;
  }, 0);

  if (environment.cpu != null) {
    if (environment.cpu.load > 80) {
      dangers.push('high_cpu_usage');
    }
  }

  if (volumeUsagePercentage > 90) {
    dangers.push('high_volume_usage');
  }

  if (environment.memory != null) {
    const memoryUsagePercentage =
      (environment.memory.used / environment.memory.total) * 100;

    if (memoryUsagePercentage > 70) {
      dangers.push('high_memory_usage');
    }
  }

  if (logs && logs.includes('ERROR')) {
    dangers.push('log_errors');
  }

  if (logs && logs.includes('WARNING')) {
    dangers.push('log_warnings');
  }

  return dangers;
}

export { GetObservationsHandler, PostObservationsHandler };
