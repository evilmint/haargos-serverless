import { StatusCodes } from 'http-status-codes';
import { performInstallationHealthCheck } from './services/perform-installation-health-check.js';
import { retrieveAndStoreLatestHAVersion } from './services/store-latest-ha-version.js';

export const handler = async (_event: any) => {
  try {
    await retrieveAndStoreLatestHAVersion();
    await performInstallationHealthCheck();
  } catch (error) {
    console.error('An error occurred:', error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify(`An error occurred while processing your request. Error: ${error}`),
    };
  }

  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify({ message: 'Monitoring completed.' }),
  };
};
