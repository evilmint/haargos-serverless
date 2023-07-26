const { QueryCommand, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const uuid = require("uuid");
const observationSchema = require("./yup-observation-schema");
const dynamoDbClient = require("../dependencies/dynamodb.js");

async function GetObservationsHandler(req, res) {
    try {
        const userId = req.headers["x-user-id"];
        const params = {
            TableName: process.env.OBSERVATION_TABLE,
            KeyConditionExpression: "#userId = :userId",
            ExpressionAttributeNames: {
                "#userId": "userId",
            },
            ExpressionAttributeValues: {
                ":userId": userId,
            },
            Limit: 3
        };

        const response = await dynamoDbClient.send(new QueryCommand(params));

        return res.status(200).json({ body: { items: response.Items } });
    } catch (error) {
        return res.status(500).json({ error: error });
    }
}

async function PostObservationsHandler(req, res) {
    try {
        let requestData = req.body;
        requestData.userId = req.headers["x-user-id"];

        const userId = req.headers["x-user-id"];

        const isInstallationValid = await checkInstallation(
            userId,
            requestData.installation_id
        );

        if (!isInstallationValid) {
            return res.status(400).json({ error: "Invalid installation." });
        }

        await observationSchema.validate(req.body, { abortEarly: true });

        requestData.timestamp = new Date().toISOString();
        requestData.dangers = createDangers(
            req.body.environment,
            req.body.logs
        );

        const healthy = requestData.dangers.filter(danger => danger != 'logs').length == 0;

        const params = {
            TableName: process.env.OBSERVATION_TABLE,
            Item: { id: uuid.v4(), ...requestData },
        };

        try {
            await dynamoDbClient.send(new PutCommand(params));
            await updateInstallation(userId, requestData.installation_id, requestData.dangers, healthy);

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
            return res
                .status(500)
                .json({ error: "Could not insert observation data." });
        }
    }
}

function createDangers(environment, logs) {
    let dangers = [];
    const cpuUsagePercentage = parseFloat(environment.cpu.load);
    const volumeUsagePercentage = parseFloat(
        environment.storage.find((item) => item.mounted_on === "/")
            .use_percentage
    );
    const memoryUsagePercentage =
        (parseFloat(environment.memory.used) /
            parseFloat(environment.memory.total)) *
        100;

    if (cpuUsagePercentage > 80) {
        dangers.push("high_cpu_usage");
    }

    if (volumeUsagePercentage > 90) {
        dangers.push("high_volume_usage");
    }

    if (memoryUsagePercentage > 70) {
        dangers.push("high_memory_usage");
    }

    if (logs && (logs.includes("ERROR") || logs.includes("WARNING"))) {
        dangers.push("logs");
    }

    return dangers;
}


async function updateInstallation(userId, installationId, dangers, healthy) {
  try {
      const installationParams = {
          TableName: process.env.INSTALLATION_TABLE,
          Key: {
              "userId": userId,
              "id": installationId,
          },
          UpdateExpression: "SET #issues = :dangers, #lastAgentConnection = :lastAgentConnection, #healthy = :healthy",
          ExpressionAttributeNames: {
              "#issues": "issues",
              "#lastAgentConnection": "last_agent_connection",
              "#healthy": "healthy"
          },
          ExpressionAttributeValues: {
              ":dangers": dangers,
              ":lastAgentConnection": new Date().toISOString(),
              ":healthy": healthy,
          },
      };

      await dynamoDbClient.send(new UpdateCommand(installationParams));
  } catch (error) {
      throw new Error("Failed to update installation: " + error.message);
  }
}

async function checkInstallation(userId, installationId) {
    const installationParams = {
        TableName: process.env.INSTALLATION_TABLE,
        KeyConditionExpression:
            "#userId = :userId AND #installationId = :installationId",
        ExpressionAttributeNames: {
            "#userId": "userId",
            "#installationId": "id",
        },
        ExpressionAttributeValues: {
            ":userId": userId,
            ":installationId": installationId,
        },
    };

    const response = await dynamoDbClient.send(
        new QueryCommand(installationParams)
    );

    return response.Items && response.Items.length > 0;
}

module.exports = { GetObservationsHandler, PostObservationsHandler };
