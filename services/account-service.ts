import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../dependencies/dynamodb';

async function deleteAccount(userId: string, secret: string) {
  try {
    const userPrimaryKey = {
      userId: userId,
      secret: secret,
    };

    // Set active to false and remove PII
    const updateParams = {
      TableName: process.env.USERS_TABLE,
      Key: userPrimaryKey,
      UpdateExpression: 'SET #active = :active, #email = :email, #full_name = :full_name',
      ExpressionAttributeNames: {
        '#active': 'active',
        '#full_name': 'full_name',
        '#email': 'email',
      },
      ExpressionAttributeValues: {
        ':active': false,
        ':full_name': '',
        ':email': '',
      },
    };

    await dynamoDbClient.send(new UpdateCommand(updateParams));
  } catch (error) {
    throw new Error('Failed to delete account: ' + error.message);
  }
}

async function updateAccount(
  userId: string,
  secret: string,
  email: string,
  fullName: string,
) {
  try {
    const userPrimaryKey = {
      userId: userId,
      secret: secret,
    };

    // Set active to false and remove PII
    // Think about how to change e-mail some time later
    const updateParams = {
      TableName: process.env.USERS_TABLE,
      Key: userPrimaryKey,
      UpdateExpression: 'SET #full_name = :full_name',
      ExpressionAttributeNames: {
        '#full_name': 'full_name',
      },
      ExpressionAttributeValues: {
        ':full_name': fullName,
      },
    };

    await dynamoDbClient.send(new UpdateCommand(updateParams));
  } catch (error) {
    throw new Error('Failed to update account: ' + error.message);
  }
}

export { updateAccount, deleteAccount };
