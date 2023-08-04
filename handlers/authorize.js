const { GetItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');

const authorize = async (req, res, next) => {
  try {
    const token = req.headers['x-token'];
    const userId = req.headers['x-user-id'];

    if (!token || !userId) {
      return res.status(400).json({
        error: 'Authentication token or user ID is missing in headers.',
      });
    }

    const params = {
      TableName: process.env.USERS_TABLE,
      Key: {
        userId: { S: userId },
        secret: { S: token },
      },
    };

    const response = await dynamoDbClient.send(new GetItemCommand(params));

    if (!response.Item) {
      return res.status(403).json({ error: 'Invalid authentication token.' });
    }

    req.user = response.Item;
    req.IN_DEV_STAGE = process.env.SLS_STAGE === 'dev';

    next(); // Proceed to the next middleware or the Lambda handler
  } catch (error) {
    console.error('Error verifying user:', error);
    return res.status(403).json({ error: 'Could not verify user.' });
  }
};

module.exports = authorize;
