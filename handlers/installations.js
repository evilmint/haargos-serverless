const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { GetItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');

const getLatestRelease = async () => {
  try {
    // Define the parameters to get the record from DynamoDB
    const params = {
      TableName: 'configuration',
      Key: {
        id: { S: 'latest_release' },
      },
    };

    // Get the record
    const command = new GetItemCommand(params);
    const result = await dynamoDbClient.send(command);

    // Extract the latest release version
    const latestRelease = result.Item?.version?.S;

    console.log(`Latest release: ${latestRelease ?? "not found"}`);
    return latestRelease;
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
};

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
    const latestHaRelease = await getLatestRelease();

    return res.status(200).json({ body: { latest_ha_release: latestHaRelease, items: response.Items } });
  } catch (error) {
    return res.status(500).json({ error: error });
  }
}

module.exports = { GetInstallationsHandler };
