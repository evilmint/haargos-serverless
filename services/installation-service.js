const { QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');

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

async function updateInstallation(userId, installationId, dangers, healthy) {
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

module.exports = { checkInstallation, updateInstallation };
