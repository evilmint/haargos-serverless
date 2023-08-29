const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = require('../dependencies/dynamodb.js');
const uuid = require('uuid');
const crypto = require('crypto');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { createInstallation } = require('../services/installation-service');

function encrypt(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'utf-8'), iv);
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const encryptedData = Buffer.concat([iv, encrypted]);
  return encryptedData.toString('base64');
}

const getLatestRelease = async () => {
  try {
    // Define the parameters to get the record from DynamoDB
    const params = {
      TableName: process.env.CONFIGURATION_TABLE,
      Key: {
        id: { S: 'latest_release' },
      },
    };

    // Get the record
    const command = new GetItemCommand(params);
    const result = await dynamoDbClient.send(command);

    // Extract the latest release version
    const latestRelease = result.Item?.version?.S;

    console.log(`Latest release: ${latestRelease ?? 'not found'}`);
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

const CreateInstallationHandler = async (req, res) => {
  try {
    let { instance, name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (!instance) {
      instance = '';
    }

    const id = uuid.v4();

    const installation = await createInstallation(req.user.userId, name, instance, req.user.secret);

    return res.status(201).json(unmarshall(installation));
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

module.exports = { CreateInstallationHandler, GetInstallationsHandler };
