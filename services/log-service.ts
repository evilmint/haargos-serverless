import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';

type Log = {
  content: string;
  type: string;
  installation_id: string;
};

export async function fetchLogByInstallationIdAndType(
  installationId: string,
  type: string,
): Promise<Log | null> {
  const logParams = {
    TableName: process.env.LOGS_TABLE,
    KeyConditionExpression: '#installation_id = :installationId AND #type = :type',
    ExpressionAttributeNames: {
      '#installation_id': 'installation_id',
      '#type': 'type',
    },
    ExpressionAttributeValues: {
      ':installationId': installationId,
      ':type': type,
    },
  };

  const logResponse = await dynamoDbClient.send(new QueryCommand(logParams));

  if (!logResponse.Items || logResponse.Items.length == 0) {
    return null;
  }

  return logResponse.Items[0] as Log;
}

/* 
Sample logs

2024-01-03 16:39:12.893 WARNING (Thread-6) [pychromecast.socket_client] [Sypialnia TV(192.168.1.102):8009] Heartbeat timeout, resetting connection
2024-01-03 16:39:12.898 INFO (Thread-6) [pychromecast.controllers] Receiver:channel_disconnected
2024-01-03 16:39:42.940 ERROR (Thread-6) [pychromecast.socket_client] [Sypialnia TV(192.168.1.102):8009] Failed to connect to service ServiceInfo(type='host', data=('192.168.1.102', 8009)), retrying in 5.0s
*/
export async function updateLogs(
  installationId: string,
  type: string,
  newContent: string,
  daysToKeep: number = 3,
  includeOnlyErrors: boolean = true,
) {
  const log = await fetchLogByInstallationIdAndType(installationId, type);

  const oldContent = log?.content ?? '';
  const logsSet = new Set<string>();

  const logs = oldContent.split('\n').concat(newContent.split('\n'));
  logs.forEach(log => logsSet.add(log));

  const currentDate = new Date();

  const processedLogs = Array.from(logsSet).filter(logEntry => {
    // Get date part of the log, e.g. 2024-01-03
    const logDate = new Date(logEntry.split(' ')[0]);
    const logAgeDays = (currentDate.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
    const isRecent = logAgeDays <= daysToKeep;

    const isLogTypeValid = includeOnlyErrors ? logEntry.includes('ERROR') : true;

    return isRecent && isLogTypeValid;
  });

  const processedLogsString = processedLogs.join('\n');

  const upsertParams = {
    TableName: process.env.LOGS_TABLE,
    Item: {
      installation_id: installationId,
      type: type,
      content: processedLogsString,
    },
  };

  try {
    await dynamoDbClient.send(new PutCommand(upsertParams));
  } catch (error) {
    throw error;
  }
}
