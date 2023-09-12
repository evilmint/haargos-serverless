import axios, { AxiosResponse } from 'axios';
import {
  ScanCommand,
  UpdateItemCommand,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';
import { performance } from 'perf_hooks';
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb';
import { dynamoDbClient } from './dependencies/dynamodb.js';

async function retrieveAndStoreLatestHAVersion(): Promise<void> {
  const response: AxiosResponse<{ tag_name: string }, any> = await axios.get(
    'https://api.github.com/repos/home-assistant/core/releases/latest',
  );
  const latestRelease = response.data.tag_name;

  const params = {
    TableName: process.env.CONFIGURATION_TABLE,
    Key: marshall({ id: 'latest_release' }),
    UpdateExpression: 'set version = :v',
    ExpressionAttributeValues: marshall({
      ':v': latestRelease,
    }),
    ReturnValues: 'ALL_NEW',
  };

  const command = new UpdateItemCommand(params);
  await dynamoDbClient.send(command);
}

type CheckInstanceHealthOutput = {
  item: InstallationItem;
  healthy: { value: boolean; last_updated: string };
  time: number;
  error?: any;
};

async function checkInstanceHealth(
  item: InstallationItem,
): Promise<CheckInstanceHealthOutput> {
  if (item.urls?.instance == null || item.urls?.instance.url == '') {
    return {
      item,
      time: 0,
      healthy: { value: false, last_updated: new Date().toISOString() },
      error: null,
    };
  }

  let time = performance.now();

  try {
    await axios.get(item.urls.instance.url);

    return {
      item,
      time: performance.now() - time,
      healthy: { value: true, last_updated: new Date().toISOString() },
      error: null,
    };
  } catch (error) {
    return {
      item,
      time: performance.now() - time,
      healthy: { value: false, last_updated: new Date().toISOString() },
      error: error,
    };
  }
}

function chunkArray<Type>(array: Type[], chunkSize: number): Type[][] {
  const chunks: Type[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    const slice = array.slice(i, i + chunkSize);
    chunks.push(slice);
  }
  return chunks;
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

type InstallationItem = {
  id?: string;
  userId?: string;
  urls: { instance: { url: string; is_verified: boolean; } };
  health_statuses: any[];
};

async function updateInstallationHealthyStatus() {
  const scanParams = {
    TableName: process.env.INSTALLATION_TABLE,
  };

  const scanResult = await dynamoDbClient.send(new ScanCommand(scanParams));
  const instances: InstallationItem[] = (scanResult.Items ?? []).map(
    item => unmarshall(item) as InstallationItem,
  );

  const chunkSize = 10;
  const chunks = chunkArray(instances, chunkSize);

  for (const chunk of chunks) {
    const promises = chunk.map(instance => checkInstanceHealth(instance));
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

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Monitoring completed.' }),
  };
}

export const handler = async (_event: any) => {
  try {
    await retrieveAndStoreLatestHAVersion();

    return await updateInstallationHealthyStatus();
  } catch (error) {
    console.error('An error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('An error occurred while processing your request.'),
    };
  }
};
