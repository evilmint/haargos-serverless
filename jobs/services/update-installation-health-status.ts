import { ScanCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import axios from 'axios';
import _ from 'lodash';
import { performance } from 'perf_hooks';
import { dynamoDbClient } from '../../lib/dynamodb.js';
import { isLocalDomain } from '../../lib/local-domain.js';

type InstallationItem = {
  id?: string;
  userId?: string;
  urls: {
    instance?: { url: string; url_type: 'PRIVATE' | 'PUBLIC'; is_verified: boolean };
  };
  health_statuses: any[];
};

export async function updateInstallationHealthyStatus() {
  const scanParams = {
    TableName: process.env.INSTALLATION_TABLE,
  };

  const scanResult = await dynamoDbClient.send(new ScanCommand(scanParams));
  const instances: InstallationItem[] = (scanResult.Items ?? [])
    .map(item => unmarshall(item) as InstallationItem)
    .filter(i => {
      if (!i.urls.instance?.url || i.urls.instance.url_type == 'PRIVATE') {
        return false;
      }

      const url = new URL(i.urls.instance.url);

      return i.urls.instance?.is_verified == true && !isLocalDomain(url);
    });

  const chunkSize = 10;
  const chunks = _.chunk(instances, chunkSize);

  for (const chunk of chunks) {
    const promises = chunk.map(instance => queryInstanceHealth(instance));
    const results = await Promise.all(promises);

    const transactItems = results.map(({ item, healthy, time }) =>
      buildUpdateAction(
        item.id ?? '',
        item.userId ?? '',
        healthy,
        time ?? 0,
        item.health_statuses,
      ),
    );

    const transactParams = {
      TransactItems: transactItems,
    };

    await dynamoDbClient.send(new TransactWriteItemsCommand(transactParams));
  }
}

type CheckInstanceHealthOutput = {
  item: InstallationItem;
  healthy: { value: boolean; last_updated: string };
  time: number;
  error?: any;
};

async function queryInstanceHealth(
  item: InstallationItem,
): Promise<CheckInstanceHealthOutput> {
  const instanceUrl = item.urls.instance?.url ?? '';

  if (instanceUrl === '') {
    return {
      item,
      time: 0,
      healthy: { value: false, last_updated: new Date().toISOString() },
      error: null,
    };
  }

  let time = performance.now();
  let isHealthy = false;

  // Would be nice to mark the failure type in the future.
  // and check if the success content is Home Assistant frontend content
  try {
    await axios.get(instanceUrl);
    isHealthy = true;
  } catch (error) {
    isHealthy = false;
  }

  return {
    item,
    time: performance.now() - time,
    healthy: { value: isHealthy, last_updated: new Date().toISOString() },
    error: null,
  };
}

const buildUpdateAction = (
  id: string,
  userId: string,
  healthy: { value: boolean; last_updated: string },
  timeTaken: number,
  currentStatuses: any[] = [],
) => {
  const healthStatus = {
    is_up: healthy.value,
    time: String(timeTaken.toFixed(3)),
    timestamp: healthy.last_updated,
  };

  // Append the new health status to the current list
  currentStatuses.push(healthStatus);

  // Ensure there are only up to 10 records, remove the oldest if necessary
  while (currentStatuses.length > 10) {
    currentStatuses.shift();
  }

  return {
    Update: {
      TableName: process.env.INSTALLATION_TABLE,
      Key: marshall({
        id: id,
        userId: userId,
      }),
      UpdateExpression: 'SET health_statuses = :new_statuses',
      ExpressionAttributeValues: marshall({
        ':new_statuses': currentStatuses,
      }),
    },
  };
};
