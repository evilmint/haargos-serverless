import { QueryCommand, PutCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../dependencies/dynamodb.js';

async function getObservations(userId: string, installationId: string, order: 'ascending' | 'descending', limit: number) {
  let params: QueryCommandInput = {
    TableName: String(process.env.OBSERVATION_TABLE),
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
    ScanIndexForward: order == 'descending' ? false : true,
  };

  if (typeof limit !== 'undefined' && limit != null) {
    params.Limit = limit;
  }

  return await dynamoDbClient.send(new QueryCommand(params));
}

async function putObservation(item: any) {
  const params = {
    TableName: process.env.OBSERVATION_TABLE,
    Item: item,
  };

  await dynamoDbClient.send(new PutCommand(params));
}

export { getObservations, putObservation };
