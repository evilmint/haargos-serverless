import { DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import moment from 'moment';
import { dynamoDbClient } from '../lib/dynamodb';
import {
  TimeComponent,
  UserAlarmConfiguration,
  UserAlarmConfigurationOutput,
  staticConfigurations,
} from './static-alarm-configurations';

export async function getAlarmConfigurations(userId: string) {
  return staticConfigurations;
}

export async function fetchUserAlarmConfigurations(
  userId: string,
): Promise<UserAlarmConfiguration[]> {
  const params = {
    TableName: process.env.ALARM_CONFIGURATION_TABLE,
    KeyConditionExpression: '#user_id = :user_id',
    ExpressionAttributeNames: {
      '#user_id': 'user_id',
    },
    ExpressionAttributeValues: {
      ':user_id': userId,
    },
    ScanIndexForward: false,
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));

  let alarmNameByType = staticConfigurations
    .map(a => a.alarmTypes)
    .flat()
    .reduce((acc, alarmType) => {
      acc[alarmType.type] = alarmType.name;
      return acc;
    }, {} as Record<string, string>);

  let items = response.Items ? (response.Items as UserAlarmConfiguration[]) : [];

  items.forEach(i => {
    i.name = alarmNameByType[i.type];
  });

  return items;
}

export async function createAlarmConfiguration(
  userId: string,
  alarmConfiguration: UserAlarmConfiguration,
): Promise<UserAlarmConfigurationOutput> {
  const id = require('crypto').randomUUID();

  const item = {
    id: id,
    created_at: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
    user_id: userId,
    deleted: false,
    ...alarmConfiguration,
  };

  const putParams: PutCommandInput = {
    TableName: process.env.ALARM_CONFIGURATION_TABLE,
    Item: item,
  };

  await dynamoDbClient.send(new PutCommand(putParams));

  let alarmNameByTypeArray = alarmNameByType();
  item.name = alarmNameByTypeArray[item.type];

  return item as UserAlarmConfigurationOutput;
}

async function fetchUserAlarmConfiguration(
  alarmId: string,
): Promise<UserAlarmConfigurationOutput | null> {
  const params: QueryCommandInput = {
    TableName: process.env.ALARM_CONFIGURATION_TABLE,
    IndexName: 'alarmId-index',
    KeyConditionExpression: '#id = :id',
    ExpressionAttributeNames: {
      '#id': 'id',
    },
    ExpressionAttributeValues: {
      ':id': alarmId,
    },
    Limit: 1,
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));

  let items = response.Items ? (response.Items as UserAlarmConfigurationOutput[]) : [];

  let alarmNameByTypeArray = alarmNameByType();
  items.forEach(i => {
    i.name = alarmNameByTypeArray[i.type];
  });

  return items.length > 0 ? items[0] : null;
}

export async function deleteUserAlarmConfiguration(
  userId: string,
  alarmId: string,
): Promise<void> {
  const alarmConfiguration = await fetchUserAlarmConfiguration(alarmId);

  if (alarmConfiguration == null) {
    throw Error('No alarm found');
  }

  const userPrimaryKey = {
    user_id: userId,
    created_at: alarmConfiguration.created_at,
  };

  const deleteParams: DeleteCommandInput = {
    TableName: process.env.ALARM_CONFIGURATION_TABLE,
    Key: marshall(userPrimaryKey),
  };

  await dynamoDbClient.send(new DeleteItemCommand(deleteParams));
}

export interface OlderThanOption {
  timeComponent: TimeComponent;
  componentValue: number;
}

export async function updateUserAlarmConfiguration(
  userId: string,
  alarmId: string,
  alarmConfiguration: UserAlarmConfiguration,
): Promise<UserAlarmConfigurationOutput> {
  const currentAlarmConfiguration = await fetchUserAlarmConfiguration(alarmId);

  if (!currentAlarmConfiguration) {
    throw Error('No alarm found');
  }

  const userPrimaryKey = {
    user_id: userId,
    created_at: currentAlarmConfiguration.created_at,
  };

  let updateExpression =
    'SET #configuration.#datapointCount = :datapointCount, #configuration.#notificationMethod = :notificationMethod';
  let expressionAttributeValues = {
    ':datapointCount': alarmConfiguration.configuration.datapointCount ?? 0,
    ':notificationMethod': alarmConfiguration.configuration.notificationMethod,
  };
  let expressionAttributeNames = {
    '#configuration': 'configuration',
    '#datapointCount': 'datapointCount',
    '#notificationMethod': 'notificationMethod',
  };

  // Conditionally add other parts based on their existence
  const attributesToUpdate = [
    'addons',
    'zigbee',
    'scripts',
    'scenes',
    'automations',
    'olderThan',
  ];
  attributesToUpdate.forEach(attr => {
    if (
      alarmConfiguration.configuration[attr] !== undefined &&
      alarmConfiguration.configuration[attr] !== null
    ) {
      updateExpression += `, #configuration.#${attr} = :${attr}`;
      expressionAttributeNames[`#${attr}`] = attr;
      expressionAttributeValues[`:${attr}`] = alarmConfiguration.configuration[attr];
    }
  });

  const updateParams: UpdateCommandInput = {
    TableName: process.env.ALARM_CONFIGURATION_TABLE,
    Key: userPrimaryKey,
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamoDbClient.send(new UpdateCommand(updateParams));
  const item = result.Attributes as UserAlarmConfigurationOutput;

  const alarmNameByTypeArray = alarmNameByType();
  item.name = alarmNameByTypeArray[item.type];

  return item;
}

function alarmNameByType(): Record<string, string> {
  return staticConfigurations
    .map(a => a.alarmTypes)
    .flat()
    .reduce((acc, alarmType) => {
      acc[alarmType.type] = alarmType.name;
      return acc;
    }, {} as Record<string, string>);
}
