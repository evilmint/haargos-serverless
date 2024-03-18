import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { maskError } from '../lib/mask-error';
import MetricCollector from '../lib/metrics/metric-collector';
import MetricStore from '../lib/metrics/metric-store';
import { updateLogsSchema } from '../lib/zod/logs-schema';
import { fetchUserAlarmConfigurations } from '../services/alarm-service';
import { fetchLogByInstallationIdAndType, updateLogs } from '../services/log-service';

const UpdateInstallationLogsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  type ValidatePayload = z.infer<typeof updateLogsSchema>;

  try {
    let payload: ValidatePayload = req.body;

    updateLogsSchema.parse(payload);

    if (!req.agentToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    await updateLogs(req.agentToken['installation_id'], payload.type, payload.content);

    try {
      const metricAnalyzer = new MetricCollector(
        new MetricStore(
          process.env.TIMESTREAM_METRIC_REGION as string,
          process.env.TIMESTREAM_METRIC_DATABASE as string,
          process.env.TIMESTREAM_METRIC_TABLE as string,
        ),
      );

      const alarmConfigurations = await fetchUserAlarmConfigurations(req.user.userId);

      await metricAnalyzer.analyzeLogsAndStoreMetrics(
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

const GetInstallationLogsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  const logType = req.params.type;
  const log = await fetchLogByInstallationIdAndType(req.params.installationId, logType);

  return res.status(StatusCodes.OK).json({
    body: { content: log?.content ?? '' },
  });
};

export { GetInstallationLogsHandler, UpdateInstallationLogsHandler };
