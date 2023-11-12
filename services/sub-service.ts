import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';

export interface SubRecord {
  userId: string;
}

export async function fetchSubRecord(sub: string): Promise<SubRecord> {
  const params = {
    TableName: process.env.SUB_TABLE,
    KeyConditionExpression: '#sub = :sub',
    ExpressionAttributeNames: {
      '#sub': 'sub',
    },
    ExpressionAttributeValues: {
      ':sub': sub,
    },
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));

  if (!response.Items || response.Items.length == 0) {
    throw new Error('Invalid authentication token');
  }

  return { userId: response.Items[0].user_id } as SubRecord;
}
