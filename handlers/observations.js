import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 } from 'uuid';
import { validate } from '../lib/yup/observation-schema';
import { dynamoDbClient } from '../dependencies/dynamodb';
import { getObservations } from '../services/observation-service';
import { checkInstallation, updateInstallationAgentData } from '../services/installation-service';

async function GetObservationsHandler(req, res) {
  try {
    const isInstallationValid = await checkInstallation(
      req.user.userId,
      req.query.installation_id,
    );

    if (!isInstallationValid) {
      return res.status(400).json({ error: 'Invalid installation.' });
    }

    const fetchLimit = Number(process.env.RETURN_OBSERVATION_COUNT);
    const response = await getObservations(
      req.user.userId,
      req.query.installation_id,
      fetchLimit,
    );

    return res.status(200).json({ body: { items: response.Items } });
  } catch (error) {
    return res.status(500).json({ error: error });
  }
}

function chunkArray(array, chunkSize) {
  let chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function PostObservationsHandler(req, res) {
  try {
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
      await validate(req.body, { abortEarly: true });
    } catch {
      if (req.IN_DEV_STAGE) {
        return res.status(400).json({ error: validationErrors });
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
      await dynamoDbClient.send(new PutCommand(params));

      // Query for all the observations
      const allObservations = await getObservations(
        userId,
        req.agentToken['installation_id'],
        1000,
      );
      const sortedObservations = allObservations.Items.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      const keepObservationCount = process.env.MAX_OBSERVATIONS_KEPT;
      // Check if we need to delete any old observations
      if (sortedObservations.length > keepObservationCount) {
        const itemsToDelete = sortedObservations
          .slice(keepObservationCount)
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
              [process.env.OBSERVATION_TABLE]: chunk,
            },
          };

          await dynamoDbClient.send(new BatchWriteItemCommand(batchDeleteParams));
        }
      }

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

function createDangers(environment, logs) {
  let dangers = [];
  const volumeUsagePercentage = parseFloat(
    environment.storage.reduce((highest, current) => {
      const cur = parseInt(current.use_percentage.slice(0, -1));
      return cur > highest ? cur : highest;
    }, 0),
  );

  if (environment.cpu != null) {
    const cpuUsagePercentage = parseFloat(environment.cpu.load);
    if (cpuUsagePercentage > 80) {
      dangers.push('high_cpu_usage');
    }
  }

  if (volumeUsagePercentage > 90) {
    dangers.push('high_volume_usage');
  }

  if (environment.memory != null) {
    const memoryUsagePercentage =
      (parseFloat(environment.memory.used) / parseFloat(environment.memory.total)) * 100;

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
