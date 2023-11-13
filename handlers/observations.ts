import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { UpgradeTierError } from '../lib/errors';
import { TierFeatureManager } from '../lib/tier-feature-manager';
import { observationSchema } from '../lib/yup/observation-schema';
import { checkInstallation } from '../services/installation-service';
import { getObservations, putObservation } from '../services/observation-service';

async function GetObservationsHandler(
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    const installationId = req.query.installation_id ?? '0';
    const isInstallationValid = await checkInstallation(req.user.userId, installationId);

    if (!isInstallationValid) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid installation.' });
    }

    const fetchLimit = TierFeatureManager.getObservationsLimit(req.user.tier);
    const response = await getObservations(
      req.user.tier,
      req.user.userId,
      installationId,
      'descending',
      fetchLimit,
    );

    return res.status(StatusCodes.OK).json({
      body: response,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
}

async function PostObservationsHandler(
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) {
  try {
    if (!req.agentToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    const userId = req.agentToken['user_id'];

    req.body.installation_id = req.agentToken['installation_id'];

    let requestData = req.body;

    const isInstallationValid = await checkInstallation(
      userId,
      req.agentToken['installation_id'],
    );

    if (!isInstallationValid) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid installation.' });
    }

    const payload: z.infer<typeof observationSchema> = req.body;

    try {
      observationSchema.parse(payload);
    } catch (error) {
      if (req.IN_DEV_STAGE) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: error });
      } else {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
      }
    }

    putObservation(req.user, req.agentToken['installation_id'], requestData);
  } catch (error) {
    if (error instanceof UpgradeTierError) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ error: 'Expired accounts cannot submit observations' });
    } else if (error.name === 'ValidationError') {
      const validationErrors = error.errors; // TODO: Don't print when not in debug

      if (req.IN_DEV_STAGE) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: validationErrors });
      } else {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
      }
    } else {
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: 'Could not insert observation data [error=' + error + '].' });
    }
  }
}

export { GetObservationsHandler, PostObservationsHandler };
