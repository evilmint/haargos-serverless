import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
} from '@aws-sdk/client-dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';

type Notification = {
  message: string;
  notification_id: string;
  title: string;
  created_at: string;
};

export async function fetchNotificationsByInstallationId(
  installationId: string,
): Promise<Notification[] | null> {
  const notificationParams = {
    TableName: process.env.NOTIFICATION_TABLE,
    KeyConditionExpression: '#installation_id = :installationId',
    IndexName: 'installationId-index',
    ExpressionAttributeNames: {
      '#installation_id': 'installation_id',
    },
    ExpressionAttributeValues: {
      ':installationId': installationId,
    },
  };

  const notificationResponse = await dynamoDbClient.send(
    new QueryCommand(notificationParams),
  );

  if (!notificationResponse.Items || notificationResponse.Items.length == 0) {
    return null;
  }

  return notificationResponse.Items as Notification[];
}

export async function updateNotifications(
  installationId: string,
  notifications: Notification[],
) {
  await deleteLogsByInstallationId(installationId);

  if (notifications.length == 0) {
    return;
  }

  const requestItems = {
    RequestItems: {
      [String(process.env.NOTIFICATION_TABLE)]: notifications.map(n => {
        return {
          PutRequest: {
            Item: {
              notification_id: {
                S: n.notification_id,
              },
              created_at: {
                S: n.created_at,
              },
              installation_id: {
                S: installationId,
              },
              message: {
                S: n.message,
              },
              title: {
                S: n.title,
              },
            },
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

async function deleteLogsByInstallationId(installationId: string) {
  const notifications = (await fetchNotificationsByInstallationId(installationId)) ?? [];

  if (notifications.length == 0) {
    return;
  }

  const requestItems: BatchWriteItemCommandInput = {
    RequestItems: {
      [String(process.env.NOTIFICATION_TABLE)]: (notifications ?? []).map(n => {
        return {
          DeleteRequest: {
            Key: marshall({
              created_at: n.created_at,
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
