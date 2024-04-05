import { PutCommand, PutCommandInput, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';
import { UserAlarmConfigurationState } from './static-alarm-configurations';

export async function fetchAlarmTriggers(installationId: string) {
  const triggerParams: QueryCommandInput = {
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

export type TriggerState = {
  state: UserAlarmConfigurationState;
  date: string;
};

export async function insertTrigger(
  installationId: string,
  userId: string,
  triggeredAt: Date,
  alarmConfigurationId: string,
  oldState: TriggerState,
  alarmState: TriggerState,
) {
  const upsertParams: PutCommandInput = {
    TableName: process.env.ALARM_TRIGGER_TABLE,
    Item: {
      installation_id: installationId,
      user_id: userId,
      triggered_at: triggeredAt.toISOString(),
      alarm_configuration: alarmConfigurationId,
      processed: 0,
      old_state: oldState,
      state: alarmState,
    },
  };

  try {
    await dynamoDbClient.send(new PutCommand(upsertParams));
  } catch (error) {
    throw error;
  }
}
