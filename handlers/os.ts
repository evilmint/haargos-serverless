import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { maskError } from '../lib/mask-error';
import { osSchema } from '../lib/zod/os-schema'; // Import OS schema
import { fetchOsInfoByInstallationId, updateOsInfo } from '../services/os-service'; // Import OS service

const UpdateInstallationOsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  type ValidatePayload = z.infer<typeof osSchema>;

  try {
    let payload: ValidatePayload = req.body;

    osSchema.parse(payload);

    if (!req.agentToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    await updateOsInfo(req.agentToken['installation_id'], payload);

    return res.status(StatusCodes.NO_CONTENT).json();
  } catch (error) {
    console.error('An error occurred:', error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: maskError(error, req.IN_DEV_STAGE) });
  }
};

const GetInstallationOsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  const osInfo = await fetchOsInfoByInstallationId(req.params.installationId);

  return res.status(StatusCodes.OK).json({
    body: osInfo,
  });
};

export { GetInstallationOsHandler, UpdateInstallationOsHandler };
