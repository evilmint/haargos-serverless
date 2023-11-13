import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import {
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { v4 } from 'uuid';
import { z } from 'zod';
import { User } from '../lib/base-request.js';
import { chunkArray } from '../lib/chunk-array.js';
import { dynamoDbClient } from '../lib/dynamodb.js';
import { UpgradeTierError } from '../lib/errors.js';
import { Danger } from '../lib/models/danger.js';
import { Tier, TierFeatureManager } from '../lib/tier-feature-manager.js';
import { environmentSchema } from '../lib/yup/observation-schema.js';
import { updateInstallationAgentData } from './installation-service.js';

type ResponseWithLogs = QueryCommandOutput & { logs: string };

function mergeLogsAndDeduplicate(queryResult: QueryCommandOutput): ResponseWithLogs {
  const logsSet = new Set();

  queryResult.Items?.forEach(item => {
    const logs = item.logs ? item.logs.split('\n') : [];
    logs.forEach(log => logsSet.add(log));
    delete item.logs; // Remove the logs property so that it's not returned to the user
  });

  const uniqueLogs = Array.from(logsSet).join('\n');

  return {
    ...queryResult,
    logs: uniqueLogs,
  };
}

async function getObservations(
  tier: Tier,
  userId: string,
  installationId: string,
  order: 'ascending' | 'descending',
  limit: number | null,
): Promise<{ Items: Record<string, any>[]; logs: string }> {
  let params: QueryCommandInput = {
    TableName: String(process.env.OBSERVATION_TABLE),
    KeyConditionExpression: '#userId = :userId AND #installation_id = :installationId',
    IndexName: 'userId-installation_id-index',
    ExpressionAttributeNames: {
      '#userId': 'userId',
      '#installation_id': 'installation_id',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':installationId': installationId,
    },
    ScanIndexForward: order == 'descending' ? false : true,
  };

  if (limit) {
    params.Limit = limit;
  }

  let allObservations: { Items: Record<string, any>[]; logs: string } = {
    Items: [],
    logs: '',
  }; // Array to hold all observations
  let lastEvaluatedKey: any = null; // Variable to track the LastEvaluatedKey

  do {
    // If there's a LastEvaluatedKey, add it to the parameters
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    let response = await dynamoDbClient.send(new QueryCommand(params));

    // Processing and filtering each batch of items
    if (!TierFeatureManager.isAdvancedAnalyticsEnabled(tier)) {
      response.Items?.forEach(observation => {
        observation.zigbee.devices.forEach(device => {
          delete device.lqi;
          delete device.battery;
        });
      });
    }

    const responseWithLogs = mergeLogsAndDeduplicate(response);

    // Append the items from this batch to the allObservations array

    if (responseWithLogs.Items) {
      allObservations.logs += `\n${responseWithLogs.logs}`;
      allObservations.Items = allObservations.Items.concat(responseWithLogs.Items);
    }

    // Update the LastEvaluatedKey
    lastEvaluatedKey = responseWithLogs.LastEvaluatedKey;
  } while (lastEvaluatedKey); // Continue looping until no more pages

  return allObservations;
}

type PutObservationRequest = {
  environment: any;
  installation_id: string;
  logs: any;
  userId: string;
  timestamp: string;
  dangers: Danger[];
};

async function putObservation(
  user: User,
  agentToken: string,
  requestData: PutObservationRequest,
) {
  if (user.tier === Tier.Expired) {
    throw new UpgradeTierError('Expired accounts cannot submit observations');
  }

  requestData.userId = user.userId;
  requestData.timestamp = new Date().toISOString();
  requestData.dangers = createDangers(requestData.environment, requestData.logs);

  const params = {
    TableName: process.env.OBSERVATION_TABLE,
    Item: { id: v4(), ...requestData },
  };

  try {
    // Query for all the observations
    const allObservations = await getObservations(
      user.tier,
      user.userId,
      agentToken,
      'ascending',
      1000,
    );
    const sortedObservations = allObservations.Items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const keepObservationCount = TierFeatureManager.getObservationsLimit(user.tier);

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
      user.userId,
      requestData.installation_id,
      requestData.dangers,
    );
  } catch (error) {
    // throw new FailedToSubmitObservationError('Failed to submit observation');
    throw error;
  }
}

function createDangers(environment: z.infer<typeof environmentSchema>, logs: string[]) {
  let dangers: Danger[] = [];

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

export { getObservations, putObservation };
