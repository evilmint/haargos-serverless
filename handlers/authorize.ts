import { GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { NextFunction, Response } from 'express';
import { BaseRequest } from '../lib/base-request';
import { decrypt } from '../lib/crypto';
import { decodeAuth0JWT } from '../lib/decode-auth0-jwt';
import { dynamoDbClient } from '../lib/dynamodb';
const AuthenticationClient = require('auth0').AuthenticationClient;

interface SubRecord {
  userId: string;
}

const authorize = async (req: BaseRequest, res: Response, next: NextFunction) => {
  try {
    const agentToken = req.headers['x-agent-token'];
    var response: any;

    // Agents
    if (agentToken) {
      const decryptedData = decrypt(agentToken);

      const userId = decryptedData['user_id'];
      const secret = decryptedData['secret'];

      const params = {
        TableName: process.env.USERS_TABLE,
        Key: marshall({
          userId: userId,
          secret: secret,
        }),
      };

      req.agentToken = decryptedData;
      response = await dynamoDbClient.send(new GetItemCommand(params));
      req.user = response.Item;
    } else if (req.auth && req.auth.token) {
      // Web
      const subIdentifier = decodeAuth0JWT(req.auth.token).subIdentifier;

      try {
        const subRecord = await fetchSubRecord(subIdentifier);
        const user = await fetchUserById(subRecord.userId);
        req.user = user;
      } catch {
        // If sub does not exist, fetch user profile and try to fetch user by e-mail
        try {
          const auth0 = new AuthenticationClient({
            domain: process.env.AUTH0_DOMAIN,
            clientId: process.env.AUTH0_CLIENT_ID,
          });

          const userProfile = await auth0.getProfile(req.auth.token);
          const user = await fetchUserByEmail(userProfile.email);

          // If user is found, add new sub
          await addNewSub(subIdentifier, user.userId);

          req.user = user;
        } catch (error) {
          return res.status(403).json({ error: 'Invalid authentication token.' });
        }
      }
    } else {
      return res.status(403).json({ error: 'Invalid authentication token.' });
    }

    if (!req.user.active) {
      return res.status(403).json({ error: 'Invalid authentication token.' });
    }

    req.IN_DEV_STAGE = process.env.SLS_STAGE === 'dev';

    next();
  } catch (error) {
    console.error('Error verifying user:', error);
    return res.status(403).json({ error: `Could not verify user [error=${error}].` });
  }
};

async function fetchSubRecord(sub: string): Promise<SubRecord> {
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

  return { userId: response.Items[0].user_id };
}

async function fetchUserById(userId: string): Promise<any> {
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

  return userResponse.Items[0];
}

async function fetchUserByEmail(email: string): Promise<any> {
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

  return userResponse.Items[0];
}

async function addNewSub(sub: string, userId: string): Promise<any> {
  const params = {
    TableName: process.env.SUB_TABLE,
    Item: marshall({
      sub: sub,
      user_id: userId,
    }),
  };

  return await dynamoDbClient.send(new PutItemCommand(params));
}

export { authorize };
