const { QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');

async function getObservations(userId, installationId) {
  const params = {
    TableName: process.env.OBSERVATION_TABLE,
    KeyConditionExpression: '#userId = :userId AND #installationId = :installationId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
      '#installationId': 'installation_id',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':installationId': installationId,
    },
    Limit: 3,
  };

  return await dynamoDbClient.send(new QueryCommand(params));
}

async function putObservation(item) {
  const params = {
    TableName: process.env.OBSERVATION_TABLE,
    Item: item,
  };

  await dynamoDbClient.send(new PutCommand(params));
}

module.exports = { getObservations, putObservation };
