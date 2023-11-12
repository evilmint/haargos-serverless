import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { User } from '../lib/base-request';
import { dynamoDbClient } from '../lib/dynamodb';

export async function fetchUserById(userId: string): Promise<User> {
  const userParams = {
    TableName: process.env.USERS_TABLE,
    KeyConditionExpression: '#userId = :userId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  };

  const userResponse = await dynamoDbClient.send(new QueryCommand(userParams));

  if (!userResponse.Items || userResponse.Items.length == 0) {
    throw new Error('Invalid authentication token.');
  }

  return userResponse.Items[0] as User;
}

export async function fetchUserByEmail(email: string): Promise<User> {
  const userParams = {
    TableName: process.env.USERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: '#email = :email',
    ExpressionAttributeNames: {
      '#email': 'email',
    },
    ExpressionAttributeValues: {
      ':email': email,
    },
  };

  const userResponse = await dynamoDbClient.send(new QueryCommand(userParams));

  if (!userResponse.Items || userResponse.Items.length == 0) {
    throw new Error('No user found.');
  }

  return userResponse.Items[0] as User;
}
