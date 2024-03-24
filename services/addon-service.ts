import { BatchWriteItemCommand, BatchWriteItemCommandInput } from '@aws-sdk/client-dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';

type Addon = {
  name: string;
  slug: string;
  description: string;
  advanced: boolean;
  stage: string;
  version: string;
  version_latest: string;
  update_available: boolean;
  available: boolean;
  detached: boolean;
  homeassistant: string | null;
  state: string;
  repository: string;
  build: boolean;
  url: string;
  icon: boolean;
  logo: boolean;
};

export async function fetchAddonsByInstallationId(installationId: string): Promise<Addon[] | null> {
  const addonParams = {
    TableName: process.env.ADDON_TABLE,
    KeyConditionExpression: '#installation_id = :installationId',
    IndexName: 'installationId-index',
    ExpressionAttributeNames: {
      '#installation_id': 'installation_id',
    },
    ExpressionAttributeValues: {
      ':installationId': installationId,
    },
  };

  const addonResponse = await dynamoDbClient.send(new QueryCommand(addonParams));

  if (!addonResponse.Items || addonResponse.Items.length == 0) {
    return null;
  }

  return addonResponse.Items as Addon[];
}

export async function updateAddons(installationId: string, addons: Addon[]) {
  await deleteAddonsByInstallationId(installationId);

  if (addons.length === 0) {
    return;
  }

  const requestItems = {
    RequestItems: {
      [String(process.env.ADDON_TABLE)]: addons.map(addon => {
        return {
          PutRequest: {
            Item: marshall({
              installation_id: installationId,
              ...addon,
            }),
          },
        };
      }),
    },
  };

  try {
    await dynamoDbClient.send(new BatchWriteItemCommand(requestItems));
  } catch (error) {
    throw error;
  }
}

async function deleteAddonsByInstallationId(installationId: string) {
  const addons = (await fetchAddonsByInstallationId(installationId)) ?? [];

  if (addons.length === 0) {
    return;
  }

  const requestItems: BatchWriteItemCommandInput = {
    RequestItems: {
      [String(process.env.ADDON_TABLE)]: addons.map(addon => {
        return {
          DeleteRequest: {
            Key: marshall({
              slug: addon.slug,
              installation_id: installationId,
            }),
          },
        };
      }),
    },
  };

  try {
    await dynamoDbClient.send(new BatchWriteItemCommand(requestItems));
  } catch (error) {
    throw error;
  }
}
