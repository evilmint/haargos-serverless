import cors from 'cors';
import express from 'express';
import { auth } from 'express-oauth2-jwt-bearer';
import serverless from 'serverless-http';
import { authorize } from './handlers/authorize';
import { PostContactHandler } from './handlers/contact';
import { notFoundHandler } from './handlers/not-found';
import { UsersMeHandler } from './handlers/users';
import { compressForAWSLambda } from './lib/compression';

import { CreateAccountHandler, DeleteAccountHandler, UpdateAccountHandler } from './handlers/account';
import {
  CreateInstallationHandler,
  DeleteInstallationHandler,
  GetInstallationsHandler,
  UpdateInstallationHandler,
} from './handlers/installations';
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
app.post('/account', [jwtCheck], CreateAccountHandler);
app.put('/account', [jwtCheck, authorize], UpdateAccountHandler);
app.delete('/account', [jwtCheck, authorize], DeleteAccountHandler);
app.get('/observations', [jwtCheck, authorize], GetObservationsHandler);
app.post('/observations', authorize, PostObservationsHandler);
app.post('/contact', PostContactHandler);

app.use(notFoundHandler);

export const handler = serverless(app);
