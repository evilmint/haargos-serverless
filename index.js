const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

const { UsersMeHandler } = require('./handlers/users');
const notFoundHandler = require('./handlers/not-found');
const authorize = require('./handlers/authorize');
const { auth } = require('express-oauth2-jwt-bearer');
const {
  GetInstallationsHandler,
  CreateInstallationHandler,
} = require('./handlers/installations');
const {
  PostObservationsHandler,
  GetObservationsHandler,
} = require('./handlers/observations');

const app = express();

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256',
});

app.use(cors());
app.use(express.json());

app.get('/users/me', [jwtCheck, authorize], UsersMeHandler);
app.get('/installations', [jwtCheck, authorize], GetInstallationsHandler);
app.post('/installations', [jwtCheck, authorize], CreateInstallationHandler);
app.get('/observations', [jwtCheck, authorize], GetObservationsHandler);
app.post('/observations', authorize, PostObservationsHandler);

app.use(notFoundHandler);

module.exports.handler = serverless(app);
