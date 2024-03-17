import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { maskError } from '../lib/mask-error';
import { supervisorSchema } from '../lib/zod/supervisor-schema';
import {
  fetchSupervisorInfoByInstallationId,
  updateSupervisorInfo,
} from '../services/supervisor-service';

const UpdateInstallationSupervisorHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  type ValidatePayload = z.infer<typeof supervisorSchema>;

  try {
    let payload: ValidatePayload = req.body;

    supervisorSchema.parse(payload);

    if (!req.agentToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    await updateSupervisorInfo(req.agentToken['installation_id'], payload);

    return res.status(StatusCodes.NO_CONTENT).json();
  } catch (error) {
    console.error('An error occurred:', error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: maskError(error, req.IN_DEV_STAGE) });
  }
};

const GetInstallationSupervisorHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  const supervisorInfo = await fetchSupervisorInfoByInstallationId(req.params.installationId);

  return res.status(StatusCodes.OK).json({
    body: supervisorInfo,
  });
};

export { GetInstallationSupervisorHandler, UpdateInstallationSupervisorHandler };
