import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../dependencies/dynamodb';
import { decrypt } from '../lib/crypto';
import { decodeAuth0JWT } from '../lib/decode-auth0-jwt';
import { NextFunction, Response } from 'express';
import { BaseRequest } from '../lib/base-request';

const authorize = async (req: BaseRequest, res: Response, next: NextFunction) => {
  try {
    const agentToken = req.headers['x-agent-token'];
    var response: any;

    if (agentToken) {
      const decryptedData = decrypt(agentToken);

      const userId = decryptedData['user_id'];
      const secret = decryptedData['secret'];

      const params = {
        TableName: process.env.USERS_TABLE,
        Key: {
          userId: { S: userId },
          secret: { S: secret },
        },
      };

      req.agentToken = decryptedData;
      response = await dynamoDbClient.send(new GetItemCommand(params));
      req.user = response.Item;
    } else if (req.auth && req.auth.token) {
      const params = {
        TableName: process.env.USERS_TABLE,
        IndexName: 'sub-index',
        KeyConditionExpression: '#sub = :sub',
        ExpressionAttributeNames: {
          '#sub': 'sub',
        },
        ExpressionAttributeValues: {
          ':sub': decodeAuth0JWT(req.auth.token).subIdentifier,
        },
      };

      response = await dynamoDbClient.send(new QueryCommand(params));

      if (!response.Items || response.Items.length == 0) {
        return res.status(403).json({ error: 'Invalid authentication token.' });
      }

      req.user = response.Items[0];
    } else {
      return res.status(403).json({ error: 'Invalid authentication token.' });
    }

    if (!req.user.active) {
      return res.status(403).json({ error: 'Invalid authentication token.' });
    }

    req.IN_DEV_STAGE = process.env.SLS_STAGE === 'dev';

    next(); // Proceed to the next middleware or the Lambda handler
  } catch (error) {
    console.error('Error verifying user:', error);
    return res.status(403).json({ error: `Could not verify user [error=${error}].` });
  }
};

export { authorize };
