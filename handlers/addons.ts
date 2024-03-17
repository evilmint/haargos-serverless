import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { maskError } from '../lib/mask-error';
import MetricAnalyzer from '../lib/metrics/metric-analyzer';
import MetricStore from '../lib/metrics/metric-store';
import { updateAddonsSchema } from '../lib/zod/addons-schema';
import { fetchAddonsByInstallationId, updateAddons } from '../services/addon-service';
import { fetchUserAlarmConfigurations } from '../services/alarm-service';

const UpdateInstallationAddonsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  type ValidatePayload = z.infer<typeof updateAddonsSchema>;

  try {
    let payload: ValidatePayload = req.body;

    updateAddonsSchema.parse(payload);

    if (!req.agentToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    await updateAddons(req.agentToken['installation_id'], payload);

    try {
      const observationMetricAnalyzer = new MetricAnalyzer(
        new MetricStore(
          process.env.TIMESTREAM_METRIC_REGION as string,
          process.env.TIMESTREAM_METRIC_DATABASE as string,
          process.env.TIMESTREAM_METRIC_TABLE as string,
        ),
      );

      const alarmConfigurations = await fetchUserAlarmConfigurations(req.user.userId);

      observationMetricAnalyzer.analyzeAddonsAndStoreMetrics(
        req.agentToken['installation_id'],
        payload,
        alarmConfigurations,
      );
    } catch (error) {
      throw new Error('Failed with timestream' + error);
    }

    return res.status(StatusCodes.NO_CONTENT).json();
  } catch (error) {
    console.error('An error occurred:', error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: maskError(error, req.IN_DEV_STAGE) });
  }
};

const GetInstallationAddonsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  const addons = (await fetchAddonsByInstallationId(req.params.installationId)) ?? [];

  return res.status(StatusCodes.OK).json({
    body: { addons: addons },
  });
};

export { GetInstallationAddonsHandler, UpdateInstallationAddonsHandler };
