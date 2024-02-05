import cors from 'cors';
import express from 'express';
import { auth } from 'express-oauth2-jwt-bearer';
import serverless from 'serverless-http';
import { assignEnvironments, authorize } from './handlers/authorize';
import { PostContactHandler } from './handlers/contact';
import { notFoundHandler } from './handlers/not-found';
import { UsersMeHandler } from './handlers/users';
import { compressForAWSLambda } from './lib/compression';

import {
  CreateAccountHandler,
  DeleteAccountHandler,
  UpdateAccountHandler,
} from './handlers/account';
import { CreateAlarmConfigurationHandler, GetAlarmConfigurationsHandler, GetUserAlarmConfigurationsHandler } from './handlers/alarms';
import { GetAgentConfigHandler } from './handlers/config';
import {
  CreateInstallationHandler,
  DeleteInstallationHandler,
  GetInstallationsHandler,
  UpdateInstallationHandler,
} from './handlers/installations';
import {
  GetInstallationLogsHandler,
  UpdateInstallationLogsHandler,
} from './handlers/logs';

import {
  GetInstallationNotificationsHandler,
  UpdateInstallationNotificationsHandler,
} from './handlers/notifications';

import { StatusCodes } from 'http-status-codes';
import {
  GetInstallationAddonsHandler,
  UpdateInstallationAddonsHandler,
} from './handlers/addons';
import {
  GetInstallationPendingJobsHandler,
  ListJobsHandler,
  SubmitJobHandler,
  UpdateJobStatusHandler,
} from './handlers/jobs';
import { GetObservationsHandler, PostObservationsHandler } from './handlers/observations';
import { GetInstallationOsHandler, UpdateInstallationOsHandler } from './handlers/os';
import {
  GetInstallationSupervisorHandler,
  UpdateInstallationSupervisorHandler,
} from './handlers/supervisor';

const app = express();

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256',
});

app.use(cors());
app.use(express.json());
app.use(compressForAWSLambda);

// Agent 
app.put('/installations/addons', authorize, UpdateInstallationAddonsHandler);
app.put(
  '/installations/notifications',
  authorize,
  UpdateInstallationNotificationsHandler,
);
app.put('/installations/logs', authorize, UpdateInstallationLogsHandler);
app.put('/installations/supervisor', authorize, UpdateInstallationSupervisorHandler);
app.put('/installations/os', authorize, UpdateInstallationOsHandler);
app.get('/installations/jobs/pending', authorize, GetInstallationPendingJobsHandler);
app.post('/installations/jobs/:jobId/complete', authorize, UpdateJobStatusHandler);

// Web
app.get('/users/me', [jwtCheck, authorize], UsersMeHandler);
app.get('/installations', [jwtCheck, authorize], GetInstallationsHandler);
app.post('/installations', [jwtCheck, authorize], CreateInstallationHandler);
app.get(
  '/installations/:installationId/logs/:type',
  [jwtCheck, authorize],
  GetInstallationLogsHandler,
);
app.get('/installations/:installationId/jobs', [jwtCheck, authorize], ListJobsHandler);
app.post('/installations/:installationId/jobs', [jwtCheck, authorize], SubmitJobHandler);

app.get(
  '/installations/:installationId/addons',
  [jwtCheck, authorize],
  GetInstallationAddonsHandler,
);
app.get(
  '/installations/:installationId/supervisor',
  [jwtCheck, authorize],
  GetInstallationSupervisorHandler,
);
app.get(
  '/alarms/configurations',
  [jwtCheck, authorize],
  GetAlarmConfigurationsHandler,
);
app.get(
  '/alarms',
  [jwtCheck, authorize],
  GetUserAlarmConfigurationsHandler,
);
app.post(
  '/alarms/configurations',
  [jwtCheck, authorize],
  CreateAlarmConfigurationHandler,
);
app.get(
  '/installations/:installationId/os',
  [jwtCheck, authorize],
  GetInstallationOsHandler,
);
app.get(
  '/installations/:installationId/notifications',
  [jwtCheck, authorize],
  GetInstallationNotificationsHandler,
);
app.put(
  '/installations/:installationId',
  [jwtCheck, authorize],
  UpdateInstallationHandler,
);
app.delete(
  '/installations/:installationId',
  [jwtCheck, authorize],
  DeleteInstallationHandler,
);
app.post('/account', [jwtCheck, assignEnvironments], CreateAccountHandler);
app.put('/account', [jwtCheck, authorize], UpdateAccountHandler);
app.delete('/account', [jwtCheck, authorize], DeleteAccountHandler);
app.get('/observations', [jwtCheck, authorize], GetObservationsHandler);
app.post('/contact', PostContactHandler);

// Agent

app.get('/agent-config', authorize, GetAgentConfigHandler);
app.post('/observations', authorize, PostObservationsHandler);

app.use(notFoundHandler);

const errorHandler = (err, _req, res, next) => {
  if (err.status === StatusCodes.UNAUTHORIZED) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Unauthorized access' });
  }

  next(err);
};
app.use(errorHandler);

export const handler = serverless(app);
