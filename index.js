const express = require("express");
const serverless = require("serverless-http");
const cors = require('cors')

const {
    PostObservationsHandler,
    GetObservationsHandler,
} = require("./handlers/observations");
const { UsersMeHandler } = require("./handlers/users");

const notFoundHandler = require("./handlers/not-found");
const authorize = require("./handlers/authorize");
const { GetInstallationsHandler } = require("./handlers/installations");

const app = express();

app.use(cors())
app.use(express.json());

app.get("/users/me", authorize, UsersMeHandler);
app.get("/installations", authorize, GetInstallationsHandler);
app.get("/observations", authorize, GetObservationsHandler);
app.post("/observations", authorize, PostObservationsHandler);

app.use(notFoundHandler);

module.exports.handler = serverless(app);
