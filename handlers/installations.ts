import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';
import {
  createInstallation,
  deleteInstallation,
  updateInstallation,
} from '../services/installation-service';
import updateInstallationFormSchema from '../lib/yup/installation-schema';
import { NextFunction, Response } from 'express';
import { BaseRequest } from '../lib/base-request';
import { z } from 'zod';

import { marshall } from '@aws-sdk/util-dynamodb';
const getLatestRelease = async () => {
  try {
    // Define the parameters to get the record from DynamoDB
    const params = {
      TableName: process.env.CONFIGURATION_TABLE,
      Key: marshall({
        id: 'latest_release',
      }),
    };

    const command = new GetItemCommand(params);
    const result = await dynamoDbClient.send(command);
    const latestRelease = result.Item?.version?.S;
    return latestRelease;
  } catch (error) {
    throw error;
  }
};

async function GetInstallationsHandler(
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) {
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

    const response: any = await dynamoDbClient.send(new QueryCommand(params));
    const latestHaRelease = await getLatestRelease();

    return res
      .status(200)
      .json({ body: { latest_ha_release: latestHaRelease, items: response.Items } });
  } catch (error) {
    return res.status(500).json({ error: error });
  }
}

type ValidatePayload = z.infer<typeof updateInstallationFormSchema>;

const CreateInstallationHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    let payload: ValidatePayload = req.body;

    if (!payload.name) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (!payload.instance) {
      payload.instance = '';
    }

    updateInstallationFormSchema.parse(payload);

    const installation = await createInstallation(
      req.user.userId,
      payload.name,
      payload.instance,
      req.user.secret,
    );

    return res.status(201).json(installation);
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

const DeleteInstallationHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    await deleteInstallation(req.user.userId, req.params.installationId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ error: error });
  }
};

const UpdateInstallationHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    let payload: ValidatePayload = req.body;
    updateInstallationFormSchema.parse(payload);

    await updateInstallation(
      req.user.userId,
      req.params.installationId,
      payload.name,
      payload.instance,
    );
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
