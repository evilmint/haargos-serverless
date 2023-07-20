const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const express = require("express");
const serverless = require("serverless-http");

const monitoringHandler = require("./handlers/monitoring");
const notFoundHandler = require("./handlers/not-found");
const authorize = require("./handlers/authorize");

const app = express();
const dynamoDbClient = new DynamoDBClient();

app.use(express.json());

app.post("/monitoring", async (req, res) => {
  authorize(dynamoDbClient, req, res, () => monitoringHandler(dynamoDbClient, req, res));
});

app.use(notFoundHandler);

module.exports.handler = serverless(app);
