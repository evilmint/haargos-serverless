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
  UserAlarmConfigurationState,
  staticConfigurations,
} from './static-alarm-configurations';
import { TriggerState } from './trigger-service';

const { UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

export async function getAlarmConfigurations(userId: string) {
  return staticConfigurations;
}

export interface AlarmConfigurationTrigger {
  alarm_configuration: string;
  triggered_at: string;
  installation_id: string;
  state: TriggerState;
  old_state: TriggerState;
  user_id: string;
  processed: number;
}

export async function markAlarmTriggerAsProcessed(alarmTrigger: AlarmConfigurationTrigger) {
  const updateParams: UpdateCommandInput = {
    TableName: process.env.ALARM_TRIGGER_TABLE,
    Key: {
      installation_id: { S: alarmTrigger.installation_id },
      triggered_at: { S: alarmTrigger.triggered_at },
    },
    UpdateExpression: 'SET #processed = :processedValue',
    ExpressionAttributeNames: {
      '#processed': 'processed',
    },
    ExpressionAttributeValues: {
      ':processedValue': { N: '1' },
    },
  };

  await dynamoDbClient.send(new UpdateItemCommand(updateParams));
}

export async function getUnprocessedAlarmTriggers(
  limit: number | undefined = 20,
): Promise<AlarmConfigurationTrigger[]> {
  const scanParams: QueryCommandInput = {
    TableName: process.env.ALARM_TRIGGER_TABLE,
    KeyConditionExpression: '#processed = :processedValue',
    IndexName: 'processedIndex',
    ExpressionAttributeNames: {
      '#processed': 'processed',
    },
    ExpressionAttributeValues: {
      ':processedValue': 0,
    },
    Limit: limit,
  };

  return ((await dynamoDbClient.send(new QueryCommand(scanParams)))?.Items ??
    []) as AlarmConfigurationTrigger[];
}

export async function fetchUserAlarmConfigurations(
  userId: string,
): Promise<UserAlarmConfiguration[]> {
  const params: QueryCommandInput = {
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
    i.description = alarmNameByType[i.type];
  });

  return items;
}

export async function createAlarmConfiguration(
  userId: string,
  alarmConfiguration: UserAlarmConfiguration,
): Promise<UserAlarmConfigurationOutput> {
  const id = require('crypto').randomUUID();

  const item = {
    ...alarmConfiguration,
    id: id,
    created_at: moment(new Date()).utc().format(),
    updated_at: moment(new Date()).utc().format(),
    user_id: userId,
    state: 'NO_DATA',
    deleted: false,
  };

  const putParams: PutCommandInput = {
    TableName: process.env.ALARM_CONFIGURATION_TABLE,
    Item: item,
  };

  await dynamoDbClient.send(new PutCommand(putParams));

  let alarmNameByTypeArray = alarmNameByType();
  item.description = alarmNameByTypeArray[item.type];

  return item as UserAlarmConfigurationOutput;
}

export async function fetchUserAlarmConfiguration(
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
    i.description = alarmNameByTypeArray[i.type];
  });

  return items.length > 0 ? items[0] : null;
}

export async function deleteUserAlarmConfiguration(userId: string, alarmId: string): Promise<void> {
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

export async function updateUserAlarmConfigurationState(
  userId: string,
  created_at: string,
  updated_at: string,
  state: UserAlarmConfigurationState,
): Promise<void> {
  const userPrimaryKey = {
    user_id: userId,
    created_at: created_at,
  };

  const updateParams: UpdateCommandInput = {
    TableName: process.env.ALARM_CONFIGURATION_TABLE,
    Key: userPrimaryKey,
    UpdateExpression: 'SET #state = :state, #updated_at = :updated_at',
    ExpressionAttributeNames: {
      '#state': 'state',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':state': state,
      ':updated_at': updated_at,
    },
  };

  await dynamoDbClient.send(new UpdateCommand(updateParams));
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
    'SET #name = :name, #configuration.#datapointCount = :datapointCount, #configuration.#notificationMethod = :notificationMethod';
  let expressionAttributeValues = {
    ':name': alarmConfiguration.name,
    ':datapointCount': alarmConfiguration.configuration.datapointCount ?? 0,
    ':notificationMethod': alarmConfiguration.configuration.notificationMethod,
  };
  let expressionAttributeNames = {
    '#name': 'name',
    '#configuration': 'configuration',
    '#datapointCount': 'datapointCount',
    '#notificationMethod': 'notificationMethod',
  };

  if (alarmConfiguration.configuration.statFunction) {
    expressionAttributeNames[`#statFunction`] = 'statFunction';
    expressionAttributeNames[`#function`] = 'function';
    expressionAttributeValues[`:statFunction`] =
      alarmConfiguration.configuration.statFunction.function;
    updateExpression += ', #configuration.#statFunction.#function = :statFunction';
  }

  if (alarmConfiguration.configuration.logTypes) {
    expressionAttributeNames[`#logTypes`] = 'logTypes';
    expressionAttributeValues[`:logTypes`] = alarmConfiguration.configuration.logTypes;
    updateExpression += ', #configuration.#logTypes = :logTypes';
  }

  if (alarmConfiguration.configuration.textCondition) {
    expressionAttributeNames[`#textCondition`] = 'textCondition';
    expressionAttributeNames[`#matcher`] = 'matcher';
    expressionAttributeValues[`:matcher`] = alarmConfiguration.configuration.textCondition.matcher;
    updateExpression += ', #configuration.#textCondition.#matcher = :matcher';

    expressionAttributeNames[`#textConditionText`] = 'text';
    expressionAttributeValues[`:textConditionText`] =
      alarmConfiguration.configuration.textCondition.text;
    updateExpression += ', #configuration.#textCondition.#textConditionText = :textConditionText';

    expressionAttributeNames[`#textConditionCS`] = 'caseSensitive';
    expressionAttributeValues[`:textConditionCS`] =
      alarmConfiguration.configuration.textCondition.caseSensitive;
    updateExpression += ', #configuration.#textCondition.#textConditionCS = :textConditionCS';
  }

  if (alarmConfiguration.configuration.storages) {
    expressionAttributeNames[`#storages`] = 'storages';
    expressionAttributeValues[`:storages`] = alarmConfiguration.configuration.storages;
    updateExpression += ', #configuration.#storages = :storages';
  }

  if (alarmConfiguration.configuration.ltGtThan) {
    expressionAttributeNames[`#ltGtThan`] = 'ltGtThan';
    expressionAttributeNames[`#ltGtThanComparator`] = 'comparator';
    expressionAttributeNames[`#ltGtThanValue`] = 'value';
    expressionAttributeNames[`#ltGtThanValueType`] = 'valueType';
    expressionAttributeValues[`:ltGtThanValue`] = alarmConfiguration.configuration.ltGtThan.value;
    expressionAttributeValues[`:ltGtThanValueType`] =
      alarmConfiguration.configuration.ltGtThan.valueType;
    expressionAttributeValues[`:ltGtThanComparator`] =
      alarmConfiguration.configuration.ltGtThan.comparator;
    updateExpression += ', #configuration.#ltGtThan.#ltGtThanComparator = :ltGtThanComparator';
    updateExpression += ', #configuration.#ltGtThan.#ltGtThanValueType = :ltGtThanValueType';
    updateExpression += ', #configuration.#ltGtThan.#ltGtThanValue = :ltGtThanValue';
  }

  // Conditionally add other parts based on their existence
  const attributesToUpdate = ['addons', 'zigbee', 'scripts', 'scenes', 'automations', 'olderThan'];
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
  item.description = alarmNameByTypeArray[item.type];

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
