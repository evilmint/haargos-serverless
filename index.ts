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
import { GetObservationsHandler, PostObservationsHandler } from './handlers/observations';

const app = express();

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256',
});

app.use(cors());
app.use(express.json());
app.use(compressForAWSLambda);

app.put('/installations/addons', authorize, UpdateInstallationAddonsHandler);
app.put(
  '/installations/notifications',
  authorize,
  UpdateInstallationNotificationsHandler,
);
app.put('/installations/logs', authorize, UpdateInstallationLogsHandler);

// Web
app.get('/users/me', [jwtCheck, authorize], UsersMeHandler);
app.get('/installations', [jwtCheck, authorize], GetInstallationsHandler);
app.post('/installations', [jwtCheck, authorize], CreateInstallationHandler);
app.get(
  '/installations/:installationId/logs/:type',
  [jwtCheck, authorize],
  GetInstallationLogsHandler,
);
app.get(
  '/installations/:installationId/addons',
  [jwtCheck, authorize],
  GetInstallationAddonsHandler,
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
