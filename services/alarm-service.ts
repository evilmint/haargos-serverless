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

export interface AlarmConfiguration {
  name: string;
  requires_supervisor: boolean;
  alarmTypes: AlarmType[];
}

type AlarmCategory =
  | 'ADDON'
  | 'CORE'
  | 'NETWORK'
  | 'DEVICE'
  | 'ZIGBEE'
  | 'LOGS'
  | 'AUTOMATIONS'
  | 'SCRIPTS'
  | 'SCENES';

export interface OlderThanOption {
  timeComponent: TimeComponent;
  componentValue: number;
}

export interface UserAlarmConfiguration {
  type: string;
  category: AlarmCategory;
  name: string;
  configuration: {
    datapointCount?: number;
    addons?: { slug: string }[];
    scripts?: { alias: string }[];
    scenes?: { id: string }[];
    automations?: { id: string; name: string }[];
    zigbee?: { ieee: string }[];
    olderThan?: OlderThanOption;
    notificationMethod: 'E-mail';
  };
}

export interface UserAlarmConfigurationOutput {
  id: string;
  type: string;
  category: AlarmCategory;
  name: string;
  created_at: string;
  configuration: {
    datapointCount?: number;
    addons?: { slug: string }[];
    notificationMethod: 'E-mail';
  };
}

export interface AlarmTypeComponent {
  type: string;
}

export interface AlarmType {
  name: string;
  type: string;
  category: AlarmCategory;
  datapoints: 'NONE' | 'MISSING' | 'PRESENT';
  disabled: boolean;
  components?: AlarmTypeComponent[];
}

let staticConfigurations: AlarmConfiguration[] = [
  {
    name: 'HomeAssistant Core',
    requires_supervisor: false,
    alarmTypes: [
      {
        name: 'Ping unavailability',
        datapoints: 'MISSING',
        type: 'ha_ping_unavailability',
        disabled: false,
        category: 'CORE',
      },
      {
        name: 'Low memory',
        datapoints: 'PRESENT',
        type: 'host_low_memory',
        disabled: false,
        category: 'CORE',
      },
      {
        name: 'High CPU usage',
        datapoints: 'PRESENT',
        type: 'host_high_cpu',
        disabled: false,
        category: 'CORE',
      },
      {
        name: 'New HomeAssistant version',
        datapoints: 'NONE',
        type: 'ha_new_version',
        disabled: false,
        category: 'CORE',
      },
      //{ name: 'Error logs detected', datapoints: 'MISSING',type: 'ha_error_logs', disabled: false, category: 'CORE', },
      //{ name: 'Service unavailable', datapoints: 'MISSING',type: 'ha_service_unavailable', disabled: false, category: 'CORE', },
      {
        name: 'High disk usage',
        datapoints: 'PRESENT',
        type: 'host_high_disk_usage',
        disabled: false,
        category: 'CORE',
      },
      {
        name: 'Automation last trigger older than',
        datapoints: 'PRESENT',
        type: 'automations_last_trigger_older_than',
        disabled: false,
        category: 'AUTOMATIONS',
        components: [{ type: 'older_than_picker' }],
      },
      {
        name: 'Scene last trigger older than',
        datapoints: 'PRESENT',
        type: 'automations_last_trigger_older_than',
        disabled: false,
        category: 'SCENES',
        components: [{ type: 'older_than_picker' }],
      },
      {
        name: 'Script last trigger older than',
        datapoints: 'PRESENT',
        type: 'automations_last_trigger_older_than',
        disabled: false,
        category: 'SCRIPTS',
        components: [{ type: 'older_than_picker' }],
      },
      //{ name: 'Unexpected reboot', datapoints: 'MISSING',type: 'host_unexpected_reboot', disabled: false },
    ],
  },
  {
    name: 'Add-ons',
    requires_supervisor: true,
    alarmTypes: [
      {
        name: 'Stopped',
        datapoints: 'PRESENT',
        type: 'addon_stopped',
        disabled: false,
        category: 'ADDON',
      },
      {
        name: 'Update available',
        datapoints: 'NONE',
        type: 'addon_update_available',
        disabled: false,
        category: 'ADDON',
      },
      {
        name: 'High CPU usage',
        datapoints: 'PRESENT',
        type: 'addon_high_cpu',
        disabled: false,
        category: 'ADDON',
      },
      {
        name: 'High memory usage',
        datapoints: 'PRESENT',
        type: 'addon_high_memory',
        disabled: false,
        category: 'ADDON',
      },
      //{ name: 'Error logs', type: 'addon_error_logs', disabled: false },
    ],
  },
  {
    name: 'Zigbee',
    requires_supervisor: false,
    alarmTypes: [
      {
        name: 'Device low LQI',
        datapoints: 'PRESENT',
        type: 'device_offline',
        disabled: false,
        category: 'ZIGBEE',
      },
      {
        name: 'Last updated older than',
        datapoints: 'PRESENT',
        type: 'zigbee_last_updated_older_than',
        disabled: false,
        category: 'ZIGBEE',
        components: [{ type: 'older_than_picker' }],
      },
      {
        name: 'Battery low',
        datapoints: 'PRESENT',
        type: 'device_battery_low',
        disabled: false,
        category: 'ZIGBEE',
      },
      // {
      //   name: 'Unavailable entities',
      //   datapoints: 'PRESENT',
      //   type: 'device_unavailable_entities',
      //   disabled: false,
      //   category: 'DEVICE',
      // },
    ],
  },
  // {
  //   name: 'Network',
  //   requires_supervisor: false,
  //   alarmTypes: [
  //     {
  //       name: 'Network down',
  //       datapoints: 'MISSING',
  //       type: 'network_down',
  //       disabled: false,
  //       category: 'NETWORK',
  //     },
  //     {
  //       name: 'High network latency',
  //       datapoints: 'PRESENT',
  //       type: 'network_high_latency',
  //       disabled: false,
  //       category: 'NETWORK',
  //     },
  //     {
  //       name: 'High network traffic',
  //       datapoints: 'PRESENT',
  //       type: 'network_high_traffic',
  //       disabled: false,
  //       category: 'NETWORK',
  //     },
  //   ],
  // },
  {
    name: 'Logs',
    requires_supervisor: false,
    alarmTypes: [
      {
        name: 'Contains string',
        datapoints: 'PRESENT',
        type: 'logs_contain_string',
        disabled: false,
        category: 'LOGS',
      },
    ],
  },
];

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

type TimeComponent = 'Months' | 'Days' | 'Hours' | 'Minutes';

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
