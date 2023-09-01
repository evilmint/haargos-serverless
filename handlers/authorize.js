const { GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');
const AuthenticationClient = require('auth0').AuthenticationClient;
const crypto = require('crypto');
const jwt_decode = require('jwt-decode');

const auth0 = new AuthenticationClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
});

function decrypt(data, key) {
  const buffer = Buffer.from(data, 'base64');
  const iv = buffer.subarray(0, 16);
  const encryptedData = buffer.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'utf-8'), iv);
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString());
}

const authorize = async (req, res, next) => {
  try {
    const agentToken = req.headers['x-agent-token'];
    var response;

    if (agentToken) {
      const sharedKey = crypto
        .createHash('sha256')
        .update(String('a very very secret key indeed!'))
        .digest('base64')
        .slice(0, 32);
      const decryptedData = decrypt(agentToken, sharedKey);

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
          ':sub': jwt_decode(req.auth.token).sub.split('|')[1],
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
