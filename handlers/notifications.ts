import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { maskError } from '../lib/mask-error';
import { updateNotificationsSchema } from '../lib/yup/notifications-schema';
import {
  fetchNotificationsByInstallationId,
  updateNotifications,
} from '../services/notification-service';

const UpdateInstallationNotificationsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  type ValidatePayload = z.infer<typeof updateNotificationsSchema>;

  try {
    let payload: ValidatePayload = req.body;

    updateNotificationsSchema.parse(payload);

    if (!req.agentToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    await updateNotifications(req.agentToken['installation_id'], payload.notifications);

    return res.status(StatusCodes.NO_CONTENT).json();
  } catch (error) {
    console.error('An error occurred:', error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: maskError(error, req.IN_DEV_STAGE) });
  }
};

const GetInstallationNotificationsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  const notifications =
    (await fetchNotificationsByInstallationId(req.params.installationId)) ?? [];

  return res.status(StatusCodes.OK).json({
    body: { notifications: notifications },
  });
};

export { GetInstallationNotificationsHandler, UpdateInstallationNotificationsHandler };
