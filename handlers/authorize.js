const { GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb');
const { decrypt } = require('../lib/crypto');
const { decodeAuth0JWT } = require('../lib/decode-auth0-jwt');

const authorize = async (req, res, next) => {
  try {
    const agentToken = req.headers['x-agent-token'];
    var response;

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

    req.IN_DEV_STAGE = process.env.SLS_STAGE === 'dev';

    next(); // Proceed to the next middleware or the Lambda handler
  } catch (error) {
    console.error('Error verifying user:', error);
    return res.status(403).json({ error: `Could not verify user [error=${error}].` });
  }
};

module.exports = authorize;
