import axios from 'axios';
import {
  ScanCommand,
  UpdateItemCommand,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';
import { performance } from 'perf_hooks';

import { dynamoDbClient } from './dependencies/dynamodb.js';

async function retrieveLatestHAVersion() {
  const response = await axios.get(
    'https://api.github.com/repos/home-assistant/core/releases/latest',
  );
  const latestRelease = response.data.tag_name;

  console.log(`Latest release found: ${latestRelease}`);

  // Define the parameters to update or insert the record in DynamoDB
  const params = {
    TableName: process.env.CONFIGURATION_TABLE,
    Key: { id: { S: 'latest_release' } },
    UpdateExpression: 'set version = :v',
    ExpressionAttributeValues: {
      ':v': { S: latestRelease },
    },
    ReturnValues: 'ALL_NEW',
  };

  // Update or insert the record
  const command = new UpdateItemCommand(params);
  await dynamoDbClient.send(command);
  return latestRelease;
}

const checkInstanceHealth = async item => {
  if (item.instance == null || item.instance == '') {
    return {
      item,
      healthy: { value: false, last_updated: new Date().toISOString() },
      error: null,
    };
  }

  let time = performance.now();

  try {
    await axios.get(item.instance);

    return {
      item,
      time: (performance.now() - time),
      healthy: { value: true, last_updated: new Date().toISOString() },
      error: null,
    };
  } catch (error) {
    return {
      item,
      time: (performance.now() - time),
      healthy: { value: false, last_updated: new Date().toISOString() },
      error: error,
    };
  }
};

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
  currentStatuses: any[] = []
) => {
  const healthStatus = {
    M: {
      is_up: { BOOL: healthy.value },
      time: { N: String(timeTaken.toFixed(3)) },
      timestamp: { S: healthy.last_updated },
    },
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
      Key: {
        id: { S: id },
        userId: { S: userId },
      },
      UpdateExpression:
        'SET healthy.is_healthy = :is_healthy, healthy.last_updated = :last_updated, health_statuses = :new_statuses',
      ExpressionAttributeValues: {
        ':is_healthy': { BOOL: healthy.value },
        ':last_updated': { S: healthy.last_updated },
        ':new_statuses': { L: currentStatuses }
      }
    },
  };
};

async function updateInstallationHealthyStatus() {
  const scanParams = {
    TableName: process.env.INSTALLATION_TABLE,
  };

  const scanResult = await dynamoDbClient.send(new ScanCommand(scanParams));

  const instances = (scanResult.Items ?? []).map(item => ({
    id: item.id.S,
    userId: item.userId.S,
    instance: item.urls.M?.instance.S ?? '',
    health_statuses: item.health_statuses?.L ?? [],
  }));

  const chunkSize = 10;
  const chunks = chunkArray(instances, chunkSize);

  for (const chunk of chunks) {
    const promises = chunk.map(url => checkInstanceHealth(url));
    const results = await Promise.all(promises);

    const transactItems = results.map(({ item, healthy, time }) =>
      buildUpdateAction(item.id, item.userId, healthy, time ?? 0, item.health_statuses),
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
    await retrieveLatestHAVersion();

    return await updateInstallationHealthyStatus();
  } catch (error) {
    console.error('An error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('An error occurred while processing your request.'),
    };
  }
};
