import { StatusCodes } from 'http-status-codes';
import { retrieveAndStoreLatestHAVersion } from './services/store-latest-ha-version.js';
import { updateInstallationHealthyStatus } from './services/update-installation-health-status.js';

export const handler = async (_event: any) => {
  try {
    await retrieveAndStoreLatestHAVersion();
    await updateInstallationHealthyStatus();
  } catch (error) {
    console.error('An error occurred:', error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify('An error occurred while processing your request.'),
    };
  }

  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify({ message: 'Monitoring completed.' }),
  };
};
