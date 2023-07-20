const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const express = require("express");
const serverless = require("serverless-http");

const observationHandler = require("./handlers/observation");
const notFoundHandler = require("./handlers/not-found");
const authorize = require("./handlers/authorize");

const app = express();
const dynamoDbClient = new DynamoDBClient();

app.use(express.json());

app.post("/observation", async (req, res) => {
  authorize(dynamoDbClient, req, res, () => observationHandler(dynamoDbClient, req, res));
});

app.use(notFoundHandler);

module.exports.handler = serverless(app);
