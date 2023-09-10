import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDbClient } from '../dependencies/dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import {
  createInstallation,
  deleteInstallation,
  updateInstallation,
} from '../services/installation-service';
import { validate } from '../lib/yup/installation-schema';

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

    return res
      .status(200)
      .json({ body: { latest_ha_release: latestHaRelease, items: response.Items } });
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

    await validate(req.body, { abortEarly: true });

    const installation = await createInstallation(
      req.user.userId,
      name,
      instance,
      req.user.secret,
    );

    return res.status(201).json(unmarshall(installation));
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

const DeleteInstallationHandler = async (req, res) => {
  try {
    await deleteInstallation(req.user.userId, req.params.installationId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

const UpdateInstallationHandler = async (req, res) => {
  try {
    await validate(req.body, { abortEarly: true });

    let { name, instance } = req.body;

    await updateInstallation(req.user.userId, req.params.installationId, name, instance);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

export {
  CreateInstallationHandler,
  GetInstallationsHandler,
  DeleteInstallationHandler,
  UpdateInstallationHandler,
};
