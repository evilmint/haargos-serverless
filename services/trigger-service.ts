import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';
import { UserAlarmConfigurationState } from './static-alarm-configurations';

export async function fetchAlarmTriggers(installationId: string) {
  const triggerParams = {
    TableName: process.env.ALARM_TRIGGER_TABLE,
    KeyConditionExpression: '#installation_id = :installationId',
    IndexName: 'installationIdIndex',
    ExpressionAttributeNames: {
      '#installation_id': 'installation_id',
    },
    ExpressionAttributeValues: {
      ':installationId': installationId,
    },
  };

  const triggersResponse = await dynamoDbClient.send(new QueryCommand(triggerParams));

  if (!triggersResponse.Items || triggersResponse.Items.length == 0) {
    return null;
  }

  return triggersResponse.Items;
}

export async function insertTrigger(
  installationId: string,
  triggeredAt: Date,
  alarmConfigurationId: string,
  alarmState: UserAlarmConfigurationState,
) {
  const upsertParams = {
    TableName: process.env.ALARM_TRIGGER_TABLE,
    Item: {
      installation_id: installationId,
      triggered_at: triggeredAt.toISOString(),
      alarm_configuration: alarmConfigurationId,
      processed: 0,
      state: alarmState,
    },
  };

  try {
    await dynamoDbClient.send(new PutCommand(upsertParams));
  } catch (error) {
    throw error;
  }
}
