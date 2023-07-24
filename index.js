const express = require("express");
const serverless = require("serverless-http");

const { PostObservationsHandler, GetObservationsHandler } = require("./handlers/observations");
const notFoundHandler = require("./handlers/not-found");
const authorize = require("./handlers/authorize");

const app = express();
app.use(express.json());

app.get("/observations", authorize, GetObservationsHandler);
app.post("/observations", authorize, PostObservationsHandler);

app.use(notFoundHandler);

module.exports.handler = serverless(app);
