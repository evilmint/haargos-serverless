const { QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');

async function getObservations(userId, installationId, limit) {
  const params = {
    TableName: process.env.OBSERVATION_TABLE,
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
    ScanIndexForward: false, // This orders by timestamp descending
  };

  if (typeof limit !== 'undefined' && limit != null) {
    params.Limit = limit;
  }

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
