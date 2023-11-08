import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { dynamoDbClient } from '../lib/dynamodb';
import { Tier, TierResolver } from '../lib/tier-resolver';
import { environmentSchema, observationSchema } from '../lib/yup/observation-schema';
import {
  checkInstallation,
  updateInstallationAgentData,
} from '../services/installation-service';
import { getObservations } from '../services/observation-service';

function mergeLogsAndDeduplicate(queryResult) {
  // Create a Set to store unique log entries
  const logsSet = new Set();

  // Iterate over the items and add logs to the Set
  queryResult.Items.forEach(item => {
    const logs = item.logs ? item.logs.split('\n') : []; // Split logs by new line
    logs.forEach(log => logsSet.add(log)); // Add each log entry to the Set
    delete item.logs;
  });

  // Convert the Set back to an array and join it into a single string
  const uniqueLogs = Array.from(logsSet).join('\n');

  // Add the deduplicated logs to the root level of the response
  const response = {
    ...queryResult, // Spread the existing queryResult properties
    logs: uniqueLogs, // Add the deduplicated logs
  };

  return response;
}

async function GetObservationsHandler(
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const installationId = req.query.installation_id ?? '0';
    const isInstallationValid = await checkInstallation(req.user.userId, installationId);

    if (!isInstallationValid) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid installation.' });
    }

    const fetchLimit = TierResolver.getObservationsLimit(req.user.tier);
    const response = await getObservations(
      req.user.userId,
      installationId,
      'descending',
      fetchLimit,
    );

    const resultWithMergedLogs = await mergeLogsAndDeduplicate(response);

    return res.status(StatusCodes.OK).json({
      body: { Items: resultWithMergedLogs.Items, logs: resultWithMergedLogs.logs },
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
}

function chunkArray(array: any[], chunkSize: number) {
  let chunks: any[] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

type ValidatePayload = z.infer<typeof observationSchema>;

async function PostObservationsHandler(
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    if (!req.agentToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    const userId = req.agentToken['user_id'];

    req.body.installation_id = req.agentToken['installation_id'];

    let requestData = req.body;

    const isInstallationValid = await checkInstallation(
      userId,
      req.agentToken['installation_id'],
    );

    if (!isInstallationValid) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid installation.' });
    }

    const payload: ValidatePayload = req.body;

    try {
      observationSchema.parse(payload);
    } catch (error) {
      if (req.IN_DEV_STAGE) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: error });
      } else {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
      }
    }

    if (req.user.tier === Tier.Expired) {
      // Throw when in a service
      // throw new UpgradeTierError('Expired accounts cannot submit observations');
      return res
        .status(StatusCodes.CONFLICT)
        .json({ error: 'Expired accounts cannot submit observations' });
    }

    requestData.userId = userId;
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

      const keepObservationCount = TierResolver.getObservationsLimit(req.user.tier);

      // Check if we need to delete any old observations
      if (sortedObservations.length > keepObservationCount) {
        const itemsToDelete = sortedObservations
          .slice(keepObservationCount - 1)
          .map(observation => {
            return {
              DeleteRequest: {
                Key: marshall({
                  userId: observation.userId,
                  timestamp: observation.timestamp,
                }),
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

      return res.json({ status: StatusCodes.OK });
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = error.errors; // TODO: Don't print when not in debug

      if (req.IN_DEV_STAGE) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: validationErrors });
      } else {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
      }
    } else {
      // Other unexpected errors
      console.error(error);
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: 'Could not insert observation data [error=' + error + '].' });
    }
  }
}

function createDangers(environment: z.infer<typeof environmentSchema>, logs: string[]) {
  let dangers: string[] = [];
  const volumeUsagePercentage =
    environment.storage?.reduce((highest, current) => {
      const cur = parseInt(current.use_percentage.slice(0, -1));
      return cur > highest ? cur : highest;
    }, 0) ?? 0;

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
