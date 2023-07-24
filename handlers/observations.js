const { QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const uuid = require("uuid");
const observationSchema = require('./yup-observation-schema');
const dynamoDbClient = require('../dependencies/dynamodb.js');

async function GetObservationsHandler(req, res) {
  try {
    const userId = req.headers["x-user-id"];
    const params = {
      TableName: process.env.OBSERVATION_TABLE,
      KeyConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#userId": "userId"
      },
      ExpressionAttributeValues: {
        ":userId": userId
      }
    };

    const response = await dynamoDbClient.send(new QueryCommand(params));

    return res.status(200).json({ "body": { "items": response.Items } });
  } catch (error) {
    return res.status(500).json({ "error": error });
  }
}

async function PostObservationsHandler(req, res) {
  try {
    let requestData = req.body;

    requestData.userId = req.headers['x-user-id'];

    await observationSchema.validate(req.body, { abortEarly: true });

    const now = new Date();
    requestData.timestamp = now.toISOString();

    const cpuUsagePercentage = parseFloat(req.body.environment.cpu.load);
    const volumeUsagePercentage = parseFloat(req.body.environment.storage.find(item => item.mounted_on === '/').use_percentage);
    const memoryUsagePercentage = parseFloat(req.body.environment.memory.used / req.body.environment.memory.total) * 100;

    let dangers = [];

    if (cpuUsagePercentage > 80) {
      dangers.push("high_cpu_usage");
    }

    if (volumeUsagePercentage > 90) {
      dangers.push("high_volume_usage");
    }

    if (memoryUsagePercentage > 70) {
      dangers.push("high_memory_usage");
    }

    if (req.body.logs && (req.body.logs.includes("ERROR") || req.body.logs.includes("WARNING"))) {
      dangers.push("logs");
    }

    requestData.dangers = dangers;

    const params = {
      TableName: process.env.OBSERVATION_TABLE,
      Item: { id: uuid.v4(), ...requestData },
    };

    try {
      await dynamoDbClient.send(new PutCommand(params));
      res.json({ status: 200 });
    } catch (error) {
      console.log(error);

      return res.status(500).json({ error: error });
    }
  } catch (error) {
    if (error.name === "ValidationError") {
      const validationErrors = error.errors; // TODO: Don't print when not in debug

      if (req.IN_DEV_STAGE) {
        return res.status(400).json({ error: validationErrors });
      } else {
        return res.status(400).json({ error: "Bad request" });
      }
    } else {
      // Other unexpected errors
      console.error(error);
      return res.status(500).json({ error: "Could not insert observation data." });
    }
  }
}

module.exports = { GetObservationsHandler, PostObservationsHandler };
