import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb.js';
import { encrypt } from '../lib/crypto.js';
import { v4 } from 'uuid';
import { marshall } from '@aws-sdk/util-dynamodb';
import randomstring from 'randomstring';

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
  url: string,
) {
  try {
    const installationParams = {
      TableName: process.env.INSTALLATION_TABLE,
      Key: {
        userId: userId,
        id: installationId,
      },
      UpdateExpression: 'SET #name = :name, #urls.#instance.#url = :url',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#urls': 'urls',
        '#url': 'url',
        '#instance': 'instance',
      },
      ExpressionAttributeValues: {
        ':name': name,
        ':url': url,
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
      Key: marshall({
        userId: userId,
        id: installationId,
      }),
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
    userId: userId,
    id: id,
    agent_token: agentToken,
    issues: [],
    health_statuses: [],
    last_agent_connection: null,
    name: name,
    notes: '',
    urls: {
      instance: instance ? { is_verified: false, url: instance, verification_status: 'PENDING' } : null,
    },
  };

  const params = {
    TableName: process.env.INSTALLATION_TABLE,
    Item: marshall(installation),
  };

  await dynamoDbClient.send(new PutItemCommand(params));

  if (installation.urls.instance) {
    await createDnsVerificationRecord(
      installation.id,
      'instance',
      installation.urls.instance.url,
    );
  }

  return installation;
}

async function createDnsVerificationRecord(
  installationId: string,
  type: 'instance',
  instanceUrl: string,
) {
  const hostName = new URL(instanceUrl).host;

  const codeLength = 14;
  const subdomainPrefix = `_${randomstring.generate({ length: codeLength })}`;
  const verificationValue = randomstring.generate({ length: codeLength });

  const dnsVerification = {
    installation_id: installationId,
    type: type,
    subdomain: `${subdomainPrefix}.${hostName}`,
    value: `_haargos.dns_verification.value=${verificationValue}`,
    attempts: 0
  };

  const params = {
    TableName: process.env.DNS_VERIFICATION_TABLE,
    Item: marshall(dnsVerification),
  };

  await dynamoDbClient.send(new PutItemCommand(params));
}

export {
  checkInstallation,
  updateInstallationAgentData,
  updateInstallation,
  createInstallation,
  deleteInstallation,
};
