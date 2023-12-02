import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import {
  createInstallationFormSchema,
  updateInstallationFormSchema,
} from '../lib/yup/installation-schema';
import {
  createInstallation,
  deleteInstallation,
  getInstallations,
  getLatestRelease,
  updateInstallation,
} from '../services/installation-service';

import { StatusCodes } from 'http-status-codes';
import { InstallationLimitError } from '../lib/errors';
import { maskError } from '../lib/mask-error';

interface GetInstallationsResponse {
  body: GetInstallationsBody;
}

interface GetInstallationsBody {
  latest_ha_release: string | null;
  items: GetInstallationsItem[];
}

interface GetInstallationsItem {
  health_statuses: GetInstallationsHealthStatus[];
  urls: {
    instance: GetInstallationsInstance;
  };
  agent_token: string;
  issues: string[];
  userId: string;
  notes: string;
  last_agent_connection: string;
  id: string;
  name: string;
}

interface GetInstallationsHealthStatus {
  is_up: boolean;
  time: string; // Assuming 'time' is a string since the provided values are not standard numbers.
  timestamp: string;
}

interface GetInstallationsInstance {
  is_verified: boolean;
  subdomain: string;
  subdomain_value: string;
  url: string;
  verification_status: string;
}

async function GetInstallationsHandler(
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const latestHaRelease = await getLatestRelease();
    const result = await getInstallations(req.user.userId);

    const response = {
      body: {
        latest_ha_release: latestHaRelease ?? null,
        items: result.Items,
      },
    } as GetInstallationsResponse;

    return res.status(StatusCodes.OK).json(response);
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: maskError(error, req.IN_DEV_STAGE) });
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
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: maskError(error, req.IN_DEV_STAGE) });
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
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: maskError(error, req.IN_DEV_STAGE) });
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
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: maskError(error, req.IN_DEV_STAGE) });
  }
};

export {
  CreateInstallationHandler,
  DeleteInstallationHandler,
  GetInstallationsHandler,
  UpdateInstallationHandler
};

