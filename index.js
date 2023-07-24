const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const express = require("express");
const serverless = require("serverless-http");

const { PostObservationsHandler, GetObservationsHandler } = require("./handlers/observations");
const notFoundHandler = require("./handlers/not-found");
const authorize = require("./handlers/authorize");

const app = express();
const dynamoDbClient = new DynamoDBClient();

app.use(express.json());

app.get("/observations", async (req, res) => {
  authorize(dynamoDbClient, req, res, () => GetObservationsHandler(dynamoDbClient, req, res));
});

app.post("/observations", async (req, res) => {
  authorize(dynamoDbClient, req, res, () => PostObservationsHandler(dynamoDbClient, req, res));
});

app.use(notFoundHandler);

module.exports.handler = serverless(app);
