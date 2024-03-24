import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';
import { UserAlarmConfigurationState } from './static-alarm-configurations';

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
