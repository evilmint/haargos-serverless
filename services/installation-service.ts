import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDbClient } from '../dependencies/dynamodb.js';
import { encrypt } from '../lib/crypto.js';
import { v4 } from 'uuid';

async function checkInstallation(userId: string, installationId: string) {
  const params = {
    TableName: process.env.INSTALLATION_TABLE,
    KeyConditionExpression: '#userId = :userId AND #installationId = :installationId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
      '#installationId': 'id',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':installationId': installationId,
    },
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));

  return response.Items && response.Items.length > 0;
}

async function updateInstallationAgentData(
  userId: string,
  installationId: string,
  dangers: string[],
) {
  try {
    const installationParams = {
      TableName: process.env.INSTALLATION_TABLE,
      Key: {
        userId: userId,
        id: installationId,
      },
      UpdateExpression:
        'SET #issues = :dangers, #lastAgentConnection = :lastAgentConnection',
      ExpressionAttributeNames: {
        '#issues': 'issues',
        '#lastAgentConnection': 'last_agent_connection',
      },
      ExpressionAttributeValues: {
        ':dangers': dangers,
        ':lastAgentConnection': new Date().toISOString(),
      },
    };

    await dynamoDbClient.send(new UpdateCommand(installationParams));
  } catch (error) {
    throw new Error('Failed to update installation: ' + error.message);
  }
}

async function updateInstallation(
  userId: string,
  installationId: string,
  name: string,
  instance: string,
) {
  try {
    const installationParams = {
      TableName: process.env.INSTALLATION_TABLE,
      Key: {
        userId: userId,
        id: installationId,
      },
      UpdateExpression: 'SET #name = :name, #urls.#instance = :instance',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#urls': 'urls',
        '#instance': 'instance',
        // Healthy is now calculated based on pings
        //'#healthy': 'healthy',
      },
      ExpressionAttributeValues: {
        ':name': name,
        ':instance': instance,
        //':healthy': healthy,
      },
    };

    await dynamoDbClient.send(new UpdateCommand(installationParams));
  } catch (error) {
    throw new Error('Failed to update installation: ' + error.message);
  }
}

async function deleteInstallation(userId: string, installationId: string) {
  try {
    const params = {
      TableName: process.env.INSTALLATION_TABLE,
      Key: {
        userId: { S: userId },
        id: { S: installationId },
      },
    };

    await dynamoDbClient.send(new DeleteItemCommand(params));
  } catch (error) {
    throw new Error('Failed to delete installation: ' + error.message);
  }
}

async function createInstallation(
  userId: string,
  name: string,
  instance: string = '',
  secret: string,
) {
  const id = v4();
  const data = {
    secret: secret,
    installation_id: id,
    user_id: userId,
  };

  const agentToken = encrypt(data);

  const installation = {
    userId: { S: userId },
    id: { S: id },
    agent_token: { S: agentToken },
    healthy: {
      M: {
        is_healthy: { BOOL: false },
        last_updated: { NULL: true },
      },
    },
    issues: { L: [] },
    last_agent_connection: { NULL: true },
    name: { S: name },
    notes: { S: '' },
    urls: {
      M: {
        instance: { S: instance },
      },
    },
  };

  const params = {
    TableName: process.env.INSTALLATION_TABLE,
    Item: installation,
  };

  await dynamoDbClient.send(new PutItemCommand(params));
  return installation;
}

export {
  checkInstallation,
  updateInstallationAgentData,
  updateInstallation,
  createInstallation,
  deleteInstallation,
};
