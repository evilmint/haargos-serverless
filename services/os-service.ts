import { PutCommand, PutCommandInput, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { dynamoDbClient } from '../lib/dynamodb';
import { osSchema } from '../lib/zod/os-schema';

type OsInfo = z.infer<typeof osSchema>;

export async function fetchOsInfoByInstallationId(installationId: string): Promise<OsInfo | null> {
  const params: QueryCommandInput = {
    TableName: process.env.OS_TABLE,
    KeyConditionExpression: '#installation_id = :installationId',
    ExpressionAttributeNames: {
      '#installation_id': 'installation_id',
    },
    ExpressionAttributeValues: {
      ':installationId': installationId,
    },
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));

  if (!response.Items || response.Items.length == 0) {
    return null;
  }

  return response.Items[0] as OsInfo;
}

export async function updateOsInfo(installationId: string, osInfo: OsInfo) {
  const putParams: PutCommandInput = {
    TableName: process.env.OS_TABLE,
    Item: {
      ...osInfo,
      installation_id: installationId,
    },
  };

  try {
    await dynamoDbClient.send(new PutCommand(putParams));
  } catch (error) {
    throw error;
  }
}
