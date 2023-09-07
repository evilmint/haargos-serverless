const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const uuid = require('uuid');
const observationSchema = require('../lib/yup/observation-schema');
const dynamoDbClient = require('../dependencies/dynamodb');
const { getObservations } = require('../services/observation-service');
const {
  checkInstallation,
  updateInstallationAgentData,
} = require('../services/installation-service');

async function GetObservationsHandler(req, res) {
  try {
    const isInstallationValid = await checkInstallation(
      req.user.userId,
      req.query.installation_id,
    );

    if (!isInstallationValid) {
      return res.status(400).json({ error: 'Invalid installation.' });
    }

    const response = await getObservations(req.user.userId, req.query.installation_id);

    return res.status(200).json({ body: { items: response.Items } });
  } catch (error) {
    return res.status(500).json({ error: error });
  }
}

async function PostObservationsHandler(req, res) {
  try {
    const userId = req.agentToken['user_id'];

    req.body.installation_id = req.agentToken['installation_id'];

    let requestData = req.body;
    requestData.userId = userId;

    const isInstallationValid = await checkInstallation(
      userId,
      req.agentToken['installation_id'],
    );

    if (!isInstallationValid) {
      return res.status(400).json({ error: 'Invalid installation.' });
    }

    try {
      await observationSchema.validate(req.body, { abortEarly: true });
    } catch {
      if (req.IN_DEV_STAGE) {
        return res.status(400).json({ error: validationErrors });
      } else {
        return res.status(400).json({ error: 'Bad request' });
      }
    }

    requestData.timestamp = new Date().toISOString();
    requestData.dangers = createDangers(req.body.environment, req.body.logs);

    const params = {
      TableName: process.env.OBSERVATION_TABLE,
      Item: { id: uuid.v4(), ...requestData },
    };

    try {
      await dynamoDbClient.send(new PutCommand(params));
      await updateInstallationAgentData(userId, requestData.installation_id, requestData.dangers);

      res.json({ status: 200 });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error });
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = error.errors; // TODO: Don't print when not in debug

      if (req.IN_DEV_STAGE) {
        return res.status(400).json({ error: validationErrors });
      } else {
        return res.status(400).json({ error: 'Bad request' });
      }
    } else {
      // Other unexpected errors
      console.error(error);
      return res
        .status(500)
        .json({ error: 'Could not insert observation data [error=' + error + '].' });
    }
  }
}

function createDangers(environment, logs) {
  let dangers = [];
  const volumeUsagePercentage = parseFloat(
    environment.storage.reduce((highest, current) => {
      const cur = parseInt(current.use_percentage.slice(0, -1));
      return cur > highest ? cur : highest;
    }, 0),
  );

  if (environment.cpu != null) {
    const cpuUsagePercentage = parseFloat(environment.cpu.load);
    if (cpuUsagePercentage > 80) {
      dangers.push('high_cpu_usage');
    }
  }

  if (volumeUsagePercentage > 90) {
    dangers.push('high_volume_usage');
  }

  if (environment.memory != null) {
    const memoryUsagePercentage =
      (parseFloat(environment.memory.used) / parseFloat(environment.memory.total)) * 100;

    if (memoryUsagePercentage > 70) {
      dangers.push('high_memory_usage');
    }
  }

  if (logs && logs.includes('ERROR')) {
    dangers.push('log_errors');
  }

  if (logs && logs.includes('WARNING')) {
    dangers.push('log_warnings');
  }

  return dangers;
}

module.exports = { GetObservationsHandler, PostObservationsHandler };
