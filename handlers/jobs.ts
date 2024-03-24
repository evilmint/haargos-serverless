import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { BaseRequest } from '../lib/base-request';
import { submitJobSchema } from '../lib/zod/job-schema';
import {
  fetchJobById,
  fetchJobsByInstallationId,
  fetchPendingJobsByInstallationId,
  insertJob,
  markJobAsCompleted,
} from '../services/job-service';

const GetInstallationPendingJobsHandler = async (
  req: BaseRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    if (!req.agentToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    const installationId = req.agentToken['installation_id'];
    const pendingJobs = await fetchPendingJobsByInstallationId(installationId);

    return res.status(StatusCodes.OK).json({ body: pendingJobs });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
  }
};

const UpdateJobStatusHandler = async (req: BaseRequest, res: Response, _next: NextFunction) => {
  try {
    const installationId = req.agentToken?.installation_id;

    if (!installationId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    const job = await fetchJobById(installationId, req.params.jobId);

    if (!job) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'Job not found.' });
    }

    await markJobAsCompleted(job);
    return res.status(StatusCodes.NO_CONTENT).json();
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
  }
};

type Job = z.infer<typeof submitJobSchema>;

const SubmitJobHandler = async (req: BaseRequest, res: Response, _next: NextFunction) => {
  try {
    const jobData: Job = submitJobSchema.parse(req.body);
    const installationId = req.params.installationId;

    if (!installationId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    await insertJob(jobData, installationId);

    return res.status(StatusCodes.OK).json({ message: 'Job submitted successfully.' });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
  }
};

const ListJobsHandler = async (req: BaseRequest, res: Response, _next: NextFunction) => {
  try {
    const installationId = req.params.installationId;

    if (!installationId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Bad request' });
    }

    const jobs = await fetchJobsByInstallationId(installationId);

    return res.status(StatusCodes.OK).json({ body: { jobs: jobs } });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
  }
};

export {
  GetInstallationPendingJobsHandler,
  ListJobsHandler,
  SubmitJobHandler,
  UpdateJobStatusHandler,
};
