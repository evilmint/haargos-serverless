import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';

export interface SubRecord {
  userId: string;
  email_verified?: boolean;
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

export async function verifySubEmail(sub: string) {
  try {
    const updateParams = {
      TableName: process.env.SUB_TABLE,
      Key: { sub: sub },
      UpdateExpression: 'SET #email_verified = :email_verified',
      ExpressionAttributeNames: {
        '#email_verified': 'email_verified',
      },
      ExpressionAttributeValues: {
        ':email_verified': true,
      },
    };

    await dynamoDbClient.send(new UpdateCommand(updateParams));
  } catch (error) {
    throw new Error('Failed to update sub: ' + error.message);
  }
}
