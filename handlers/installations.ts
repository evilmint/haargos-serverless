import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { dynamoDbClient } from '../lib/dynamodb';
import {
  createInstallationFormSchema,
  updateInstallationFormSchema,
} from '../lib/yup/installation-schema';
import {
  createInstallation,
  deleteInstallation,
  updateInstallation,
} from '../services/installation-service';

import { marshall } from '@aws-sdk/util-dynamodb';
import { StatusCodes } from 'http-status-codes';
import { InstallationLimitError } from '../lib/errors';
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
      .status(StatusCodes.OK)
      .json({ body: { latest_ha_release: latestHaRelease, items: response.Items } });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
}

const CreateInstallationHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  type ValidatePayload = z.infer<typeof createInstallationFormSchema>;

  try {
    let payload: ValidatePayload = req.body;

    if (!payload.name) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: 'Missing required fields.' });
    }

    if (!payload.instance) {
      payload.instance = '';
    }

    createInstallationFormSchema.parse(payload);

    try {
      const installation = await createInstallation(
        req.user.tier,
        req.user.userId,
        payload.name,
        payload.instance.trim(),
        req.user.secret,
      );
      return res.status(StatusCodes.CREATED).json(installation);
    } catch (error) {
      if (error instanceof InstallationLimitError) {
        return res
          .status(StatusCodes.CONFLICT)
          .json({ body: 'Upgrade Tier to create more installations' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
};

const DeleteInstallationHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    await deleteInstallation(req.user.userId, req.params.installationId);
    return res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
};

const UpdateInstallationHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  type ValidatePayload = z.infer<typeof updateInstallationFormSchema>;

  try {
    let payload: ValidatePayload = req.body;
    updateInstallationFormSchema.parse(payload);

    await updateInstallation(
      req.user.userId,
      req.params.installationId,
      payload.name,
      payload.instance,
      payload.notes,
    );
    return res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
};

export {
  CreateInstallationHandler,
  DeleteInstallationHandler,
  GetInstallationsHandler,
  UpdateInstallationHandler,
};
