const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const uuid = require("uuid");
const observationSchema = require('./yup-observation-schema');

async function monitoringHandler(dynamoDbClient, req, res) {
  try {
    const requestData = req.body;
    
    await observationSchema.validate(req.body, { abortEarly: true });

    const params = {
      TableName: process.env.MONITORING_TABLE,
      Item: { id: uuid.v4(), ...requestData },
    };

    try {
      await dynamoDbClient.send(new PutCommand(params));
      res.json({ status: 200 });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Could not insert monitoring data." });
    }
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: "Bad request." });
    } else {
      // Other unexpected errors
      console.error(error);
      return res.status(500).json({ error: "Could not insert monitoring data." });
    }
  }
}

module.exports = monitoringHandler;
