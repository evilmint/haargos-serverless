import { PutCommand, PutCommandInput, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { dynamoDbClient } from '../lib/dynamodb';
import { supervisorSchema } from '../lib/zod/supervisor-schema';

type SupervisorInfo = z.infer<typeof supervisorSchema>;

export async function fetchSupervisorInfoByInstallationId(
  installationId: string,
): Promise<SupervisorInfo | null> {
  const params: QueryCommandInput = {
    TableName: process.env.SUPERVISOR_TABLE,
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

  return response.Items[0] as SupervisorInfo;
}

export async function updateSupervisorInfo(installationId: string, supervisorInfo: SupervisorInfo) {
  const putParams: PutCommandInput = {
    TableName: process.env.SUPERVISOR_TABLE,
    Item: {
      ...supervisorInfo,
      installation_id: installationId,
    },
  };

  try {
    await dynamoDbClient.send(new PutCommand(putParams));
  } catch (error) {
    throw error;
  }
}
