const express = require("express");
const serverless = require("serverless-http");

const {
    PostObservationsHandler,
    GetObservationsHandler,
} = require("./handlers/observations");
const { UsersMeHandler } = require("./handlers/users");

const notFoundHandler = require("./handlers/not-found");
const authorize = require("./handlers/authorize");

const app = express();
app.use(express.json());

app.get("/users/me", authorize, UsersMeHandler);
app.get("/observations", authorize, GetObservationsHandler);
app.post("/observations", authorize, PostObservationsHandler);

app.use(notFoundHandler);

module.exports.handler = serverless(app);
