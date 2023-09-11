import axios from 'axios';
import {
  ScanCommand,
  UpdateItemCommand,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';
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

  try {
    await axios.get(item.instance);
    return {
      item,
      healthy: { value: true, last_updated: new Date().toISOString() },
      error: null,
    };
  } catch (error) {
    return {
      item,
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
) => {
  return {
    Update: {
      TableName: process.env.INSTALLATION_TABLE,
      Key: {
        id: { S: id },
        userId: { S: userId },
      },
      UpdateExpression:
        'SET healthy.is_healthy = :is_healthy, healthy.last_updated = :last_updated',
      ExpressionAttributeValues: {
        ':is_healthy': { BOOL: healthy.value },
        ':last_updated': { S: healthy.last_updated },
      },
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
  }));

  const chunkSize = 10;
  const chunks = chunkArray(instances, chunkSize);

  for (const chunk of chunks) {
    const promises = chunk.map(url => checkInstanceHealth(url));
    const results = await Promise.all(promises);

    const transactItems = results.map(({ item, healthy }) =>
      buildUpdateAction(item.id, item.userId, healthy),
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
