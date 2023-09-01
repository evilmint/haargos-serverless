const { QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { PutItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');
const crypto = require('crypto');
const uuid = require('uuid');

async function checkInstallation(userId, installationId) {
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

async function updateInstallation(userId, installationId, dangers) {
  try {
    const installationParams = {
      TableName: process.env.INSTALLATION_TABLE,
      Key: {
        userId: userId,
        id: installationId,
      },
      UpdateExpression: 'SET #issues = :dangers, #lastAgentConnection = :lastAgentConnection',
      ExpressionAttributeNames: {
        '#issues': 'issues',
        '#lastAgentConnection': 'last_agent_connection',
        // Healthy is now calculated based on pings
        //'#healthy': 'healthy',
      },
      ExpressionAttributeValues: {
        ':dangers': dangers,
        ':lastAgentConnection': new Date().toISOString(),
        //':healthy': healthy,
      },
    };

    await dynamoDbClient.send(new UpdateCommand(installationParams));
  } catch (error) {
    throw new Error('Failed to update installation: ' + error.message);
  }
}

function encrypt(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'utf-8'), iv);
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const encryptedData = Buffer.concat([iv, encrypted]);
  return encryptedData.toString('base64');
}

async function createInstallation(userId, name, instance = '', secret) {
  const id = uuid.v4();
  const data = {
    secret: secret,
    installation_id: id,
    user_id: userId,
  };

  const sharedKey = crypto
    .createHash('sha256')
    .update(String('a very very secret key indeed!'))
    .digest('base64')
    .slice(0, 32);
  const agentToken = encrypt(data, sharedKey);

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

module.exports = { checkInstallation, updateInstallation, createInstallation };
