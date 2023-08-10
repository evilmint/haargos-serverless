const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');

async function GetInstallationsHandler(req, res) {
  try {
    const params = {
      TableName: process.env.INSTALLATION_TABLE,
      KeyConditionExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':userId': req.user.userId,
      },
    };

    const response = await dynamoDbClient.send(new QueryCommand(params));

    return res.status(200).json({ body: { items: response.Items } });
  } catch (error) {
    return res.status(500).json({ error: req.user });
  }
}

module.exports = { GetInstallationsHandler };
