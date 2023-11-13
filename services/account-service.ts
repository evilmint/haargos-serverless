import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { addNewSub } from '../lib/add-new-sub';
import { dynamoDbClient } from '../lib/dynamodb';
import { Tier } from '../lib/tier-feature-manager';

const AuthenticationClient = require('auth0').AuthenticationClient;

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
        ':email': `${require('crypto').randomUUID()}@email.com`,
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

function generateDateStringWithAddedWeeks(weeks: number): string {
  const now = new Date();
  now.setDate(now.getDate() + weeks * 7); // Add weeks
  return now.toISOString().split('T')[0]; // Return date in YYYY-MM-DD format
}

async function createAccount(token: string, sub: string, fullName: string): Promise<any> {
  const auth0 = new AuthenticationClient({
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
  });

  try {
    const userProfile = await auth0.getProfile(token);
    const email = userProfile.email;
    const active = userProfile.email_verified;

    // Check if a user with this email already exists
    const queryParams = {
      TableName: process.env.USERS_TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
      Limit: 1,
    };

    const queryResult = await dynamoDbClient.send(new QueryCommand(queryParams));

    if (
      (queryResult.Count ?? 0) > 0 &&
      queryResult.Items &&
      queryResult.Items?.length > 0
    ) {
      // A user with this email already exists, return that record
      return queryResult.Items[0];
    }
    const activatedOn = generateDateStringWithAddedWeeks(0); // Today
    const expiresOn = generateDateStringWithAddedWeeks(2); // 2 weeks from now

    const userId = require('crypto').randomUUID(); // Generate a new userId

    // Create the account in the USERS_TABLE
    const putParams = {
      TableName: process.env.USERS_TABLE,
      Item: {
        userId: userId,
        secret: require('crypto').randomUUID(),
        active: active,
        subscriptions: [
          {
            activated_on: activatedOn,
            expires_on: expiresOn,
            purchase_id: 'NEW_ACCOUNT',
            tier: Tier.Explorer,
          },
        ],
        email: email,
        full_name: fullName,
      },
    };
    await dynamoDbClient.send(new PutCommand(putParams));
    await addNewSub(sub, userId);

    const user = {
      userId: userId,
      //secret: putParams.Item.secret.S,
      active: active,
      subscriptions: [],
      email: email,
      full_name: fullName,
    };

    return user;
  } catch (error) {
    throw new Error('Failed to create account: ' + error.message);
  }
}

export { createAccount, deleteAccount, updateAccount };
