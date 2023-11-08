import { DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommandInput,
  QueryCommand,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import randomstring from 'randomstring';
import { v4 } from 'uuid';
import { encrypt } from '../lib/crypto.js';
import { dynamoDbClient } from '../lib/dynamodb.js';
import { Tier, TierResolver } from '../lib/tier-resolver.js';

async function checkInstallation(userId: string, installationId: string) {
  const params = {
    TableName: process.env.INSTALLATION_TABLE,
    KeyConditionExpression: '#userId = :userId AND #installationId = :installationId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
      '#installationId': 'id',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':installationId': installationId,
    },
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));

  return response.Items && response.Items.length > 0;
}

async function getInstallation(
  userId: string,
  installationId: string,
): Promise<Record<string, any> | undefined> {
  const params = {
    TableName: process.env.INSTALLATION_TABLE,
    KeyConditionExpression: '#userId = :userId AND #installationId = :installationId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
      '#installationId': 'id',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':installationId': installationId,
    },
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));

  return response.Items?.[0];
}

async function updateInstallationAgentData(
  userId: string,
  installationId: string,
  dangers: string[],
) {
  try {
    const installationParams = {
      TableName: process.env.INSTALLATION_TABLE,
      Key: {
        userId: userId,
        id: installationId,
      },
      UpdateExpression:
        'SET #issues = :dangers, #lastAgentConnection = :lastAgentConnection',
      ExpressionAttributeNames: {
        '#issues': 'issues',
        '#lastAgentConnection': 'last_agent_connection',
      },
      ExpressionAttributeValues: {
        ':dangers': dangers,
        ':lastAgentConnection': new Date().toISOString(),
      },
    };

    await dynamoDbClient.send(new UpdateCommand(installationParams));
  } catch (error) {
    throw new Error('Failed to update installation: ' + error.message);
  }
}

async function updateInstallation(
  userId: string,
  installationId: string,
  name: string,
  url: string,
  notes: string,
) {
  try {
    // Fetch current installation data
    const currentInstallation = await getInstallation(userId, installationId);

    if (!currentInstallation) {
      throw new Error('Failed to update installation - no installation');
    }

    // Construct the base update parameters, always updating the name
    const installationParams: UpdateCommandInput = {
      TableName: process.env.INSTALLATION_TABLE,
      Key: {
        userId: userId,
        id: installationId,
      },
      UpdateExpression: 'SET #name = :name, #notes = :notes',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#notes': 'notes',
      },
      ExpressionAttributeValues: {
        ':name': name,
        ':notes': notes,
      },
    };

    // If the supplied URL is different from the stored one, update the URL and its related fields
    if (
      currentInstallation &&
      currentInstallation.urls &&
      currentInstallation.urls.instance &&
      currentInstallation.urls.instance.url !== url
    ) {
      const { subdomain, subdomain_value } = await createDnsVerificationRecord(
        installationId,
        userId,
        'instance',
        url,
      );

      installationParams.UpdateExpression +=
        ', #urls.#instance.#url = :url, #urls.#instance.is_verified = :is_verified, #urls.#instance.verification_status = :verification_status, #urls.#instance.subdomain = :subdomain, #urls.#instance.subdomain_value = :subdomain_value';

      installationParams.ExpressionAttributeNames!['#urls'] = 'urls';
      installationParams.ExpressionAttributeNames!['#url'] = 'url';
      installationParams.ExpressionAttributeNames!['#instance'] = 'instance';

      installationParams.ExpressionAttributeValues![':url'] = url;
      installationParams.ExpressionAttributeValues![':verification_status'] = 'PENDING';
      installationParams.ExpressionAttributeValues![':is_verified'] = false;
      installationParams.ExpressionAttributeValues![':subdomain'] = subdomain;
      installationParams.ExpressionAttributeValues![':subdomain_value'] = subdomain_value;
    }

    await dynamoDbClient.send(new UpdateCommand(installationParams));
  } catch (error) {
    throw new Error('Failed to update installation: ' + error.message);
  }
}

async function deleteInstallation(userId: string, installationId: string) {
  try {
    const params: DeleteCommandInput = {
      TableName: process.env.INSTALLATION_TABLE,
      Key: marshall({
        userId: userId,
        id: installationId,
      }),
    };

    await dynamoDbClient.send(new DeleteItemCommand(params));
  } catch (error) {
    throw new Error('Failed to delete installation: ' + error.message);
  }
}

type Installation = {
  userId: string;
  id: string;
  agent_token: string;
  issues: string[];
  health_statuses: string[];
  last_agent_connection: string | null;
  name: string;
  notes: string;
  urls: {
    instance: {
      is_verified: boolean;
      url: string;
      verification_status: 'PENDING';
      subdomain: string;
      subdomain_value: string;
    } | null;
  };
};

export class InstallationLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstallationLimitError';
    Object.setPrototypeOf(this, InstallationLimitError.prototype);
  }
}

async function countUserInstallations(userId: string): Promise<number> {
  const params = {
    TableName: process.env.INSTALLATION_TABLE,
    KeyConditionExpression: '#userId = :userId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
    },
    Select: 'COUNT',
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));
  return response.Count || 0;
}

async function createInstallation(
  tier: Tier,
  userId: string,
  name: string,
  instance: string = '',
  secret: string,
) {
  const maxInstallations = TierResolver.numberOfInstallations(tier);
  const currentInstallationCount = await countUserInstallations(userId);

  if (currentInstallationCount >= maxInstallations) {
    throw new InstallationLimitError(
      'User has reached the maximum number of installations allowed.',
    );
  }

  const id = v4();
  const data = {
    secret: secret,
    installation_id: id,
    user_id: userId,
  };

  const agentToken = encrypt(data);

  const installation: Installation = {
    userId: userId,
    id: id,
    agent_token: agentToken,
    issues: [],
    health_statuses: [],
    last_agent_connection: null,
    name: name,
    notes: '',
    urls: {
      instance: null,
    },
  };

  if (instance != '') {
    const { subdomain, subdomain_value } = await createDnsVerificationRecord(
      id,
      userId,
      'instance',
      instance,
    );

    installation.urls = {
      instance: {
        is_verified: false,
        url: instance,
        verification_status: 'PENDING',
        subdomain: subdomain,
        subdomain_value: subdomain_value,
      },
    };
  }

  const params = {
    TableName: process.env.INSTALLATION_TABLE,
    Item: marshall(installation),
  };

  await dynamoDbClient.send(new PutItemCommand(params));

  if (installation.urls.instance) {
    await createDnsVerificationRecord(
      installation.id,
      userId,
      'instance',
      installation.urls.instance.url,
    );
  }

  return installation;
}

async function createDnsVerificationRecord(
  installationId: string,
  userId: string,
  type: 'instance',
  instanceUrl: string,
): Promise<{ subdomain: string; subdomain_value: string }> {
  const hostName = new URL(instanceUrl).host;

  const codeLength = 14;
  const subdomainPrefix = `_${randomstring.generate({ length: codeLength })}`;
  const verificationValue = randomstring.generate({ length: codeLength });

  const dnsVerification = {
    installation_id: installationId,
    user_id: userId,
    type: type,
    subdomain: `${subdomainPrefix}.${hostName}`,
    value: `_haargos.dns_verification.value=${verificationValue}`,
    attempts: 0,
  };

  const params = {
    TableName: process.env.DNS_VERIFICATION_TABLE,
    Item: marshall(dnsVerification),
  };

  await dynamoDbClient.send(new PutItemCommand(params));

  // Return the subdomain and subdomain_value for the installations table
  return {
    subdomain: dnsVerification.subdomain,
    subdomain_value: dnsVerification.value,
  };
}

export {
  checkInstallation,
  createInstallation,
  deleteInstallation,
  updateInstallation,
  updateInstallationAgentData,
};
