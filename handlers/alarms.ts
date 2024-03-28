import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { TypedRequestBody } from '../lib/typed-request-body';
import { createAlarmSchema } from '../lib/zod/alarm-schema';
import {
  createAlarmConfiguration as createUserAlarmConfiguration,
  deleteUserAlarmConfiguration,
  fetchUserAlarmConfigurations,
  getAlarmConfigurations,
  updateUserAlarmConfiguration,
} from '../services/alarm-service';
import { fetchAlarmTriggers } from '../services/trigger-service';

export async function GetAlarmConfigurationsHandler(
  req: TypedRequestBody<{ email: string; full_name: string }>,
  res: Response,
) {
  const alarmConfigurations = await getAlarmConfigurations(req.user.userId);

  return res.status(StatusCodes.OK).json({
    body: { configurations: alarmConfigurations },
  });
}

export async function GetAlarmConfigurationHistoryHandler(req: BaseRequest, res: Response) {
  const installationId = req.params.installationId;
  const alarmChangeHistory = await fetchAlarmTriggers(installationId);

  return res.status(StatusCodes.OK).json({
    body: { history: alarmChangeHistory },
  });
}

export async function GetUserAlarmConfigurationsHandler(req: BaseRequest, res: Response) {
  const userAlarmConfigurations = await fetchUserAlarmConfigurations(req.user.userId);

  return res.status(StatusCodes.OK).json({
    body: { configurations: userAlarmConfigurations },
  });
}

export async function CreateUserAlarmConfigurationHandler(req: BaseRequest, res: Response) {
  try {
    let payload: z.infer<typeof createAlarmSchema> = req.body;
    createAlarmSchema.parse(payload);

    const alarmConfiguration = await createUserAlarmConfiguration(req.user.userId, req.body);

    return res.status(StatusCodes.CREATED).json({ body: alarmConfiguration });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
}

export async function DeleteUserAlarmConfigurationHandler(req: BaseRequest, res: Response) {
  try {
    await deleteUserAlarmConfiguration(req.user.userId, req.params.alarmId);

    return res.status(StatusCodes.NO_CONTENT).json();
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
}

export async function PutUserAlarmConfigurationHandler(req: BaseRequest, res: Response) {
  try {
    let payload: z.infer<typeof createAlarmSchema> = req.body;
    createAlarmSchema.parse(payload);

    let userAlarmConfiguration = await updateUserAlarmConfiguration(
      req.user.userId,
      req.params.alarmId,
      req.body,
    );

    return res.status(StatusCodes.OK).json({ body: userAlarmConfiguration });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
}
