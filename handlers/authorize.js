const { GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');
const AuthenticationClient = require('auth0').AuthenticationClient;

const auth0 = new AuthenticationClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID
});

const authorize = async (req, res, next) => {
  try {
    const token = req.headers['x-token'];
    const userId = req.headers['x-user-id'];

    var response;

    if (token && userId) {
      const params = {
        TableName: process.env.USERS_TABLE,
        Key: {
          userId: { S: userId },
          secret: { S: token },
        },
      };

      response = await dynamoDbClient.send(new GetItemCommand(params));
      req.user = response.Item;
    } else {
      const userProfile = await auth0.getProfile(req.auth.token);
      const params = {
        TableName: process.env.USERS_TABLE,
        IndexName: 'email-index',
        KeyConditionExpression: '#email = :email',
        ExpressionAttributeNames: {
          '#email': 'email',
        },
        ExpressionAttributeValues: {
          ':email': userProfile.email,
        },
      };

      response = await dynamoDbClient.send(new QueryCommand(params));

      if (!response.Items || response.Items.length == 0) {
        return res.status(403).json({ error: 'Invalid authentication token.' });
      }

      req.user = response.Items[0];
    }

    req.IN_DEV_STAGE = process.env.SLS_STAGE === 'dev';

    next(); // Proceed to the next middleware or the Lambda handler
  } catch (error) {
    console.error('Error verifying user:', error);
    return res.status(403).json({ error: `Could not verify user [error=${error}].` });
  }
};

module.exports = authorize;
