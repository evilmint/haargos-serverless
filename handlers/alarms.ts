import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TypedRequestBody } from '../lib/typed-request-body';
import {
    UserAlarmConfiguration,
    createAlarmConfiguration,
    fetchUserAlarmConfigurations,
    getAlarmConfigurations,
} from '../services/alarm-service';

export async function GetAlarmConfigurationsHandler(
  req: TypedRequestBody<{ email: string; full_name: string }>,
  res: Response,
) {
  const alarmConfigurations = await getAlarmConfigurations(req.user.userId);

  return res.status(StatusCodes.OK).json({
    body: { configurations: alarmConfigurations },
  });
}

export async function GetUserAlarmConfigurationsHandler(
  req: TypedRequestBody<{ email: string; full_name: string }>,
  res: Response,
) {
  const userAlarmConfigurations = await fetchUserAlarmConfigurations(req.user.userId);

  return res.status(StatusCodes.OK).json({
    body: { configurations: userAlarmConfigurations },
  });
}

export async function CreateAlarmConfigurationHandler(
  req: TypedRequestBody<UserAlarmConfiguration>,
  res: Response,
) {
  await createAlarmConfiguration(req.user.userId, req.body);

  return res.status(StatusCodes.CREATED).json();
}
