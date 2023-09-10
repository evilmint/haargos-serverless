import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../dependencies/dynamodb.js';

interface QueryParams {
  TableName: string;
  KeyConditionExpression: string;
  IndexName: string;
  ExpressionAttributeNames: {
    [key: string]: string;
  };
  ExpressionAttributeValues: {
    ':userId': string;
    ':installationId': string;
  };
  ScanIndexForward: boolean;
  Limit?: number;
}

async function getObservations(userId: string, installationId: string, limit: number) {
  let params: QueryParams = {
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
    ScanIndexForward: false, // This orders by timestamp descending
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
