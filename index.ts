import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import { UsersMeHandler } from './handlers/users';
import { notFoundHandler } from './handlers/not-found';
import { authorize } from './handlers/authorize';
import { auth } from 'express-oauth2-jwt-bearer';
import { compressForAWSLambda } from './lib/compression';

import { GetInstallationsHandler, CreateInstallationHandler, DeleteInstallationHandler, UpdateInstallationHandler } from './handlers/installations';
import { DeleteAccountHandler, UpdateAccountHandler } from './handlers/account';
import { PostObservationsHandler, GetObservationsHandler } from './handlers/observations';

const app = express();

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256',
});

app.use(cors());
app.use(express.json());
app.use(compressForAWSLambda);
app.get('/users/me', [jwtCheck, authorize], UsersMeHandler);
app.get('/installations', [jwtCheck, authorize], GetInstallationsHandler);
app.post('/installations', [jwtCheck, authorize], CreateInstallationHandler);
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
app.put('/account', [jwtCheck, authorize], UpdateAccountHandler);
app.delete('/account', [jwtCheck, authorize], DeleteAccountHandler);
app.get('/observations', [jwtCheck, authorize], GetObservationsHandler);
app.post('/observations', authorize, PostObservationsHandler);

app.use(notFoundHandler);

export const handler = serverless(app);