import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';

export interface AlarmConfiguration {
  name: string;
  alarmTypes: AlarmType[];
}

type AlarmCategory = 'ADDON' | 'CORE' | 'NETWORK' | 'DEVICE';

export interface AlarmType {
  name: string;
  type: string;
  category: AlarmCategory;
  datapoints: 'NONE' | 'MISSING' | 'PRESENT';
  disabled: boolean;
}

let staticConfigurations: AlarmConfiguration[] = [
  {
    name: 'HomeAssistant Core',
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
      //{ name: 'Unexpected reboot', datapoints: 'MISSING',type: 'host_unexpected_reboot', disabled: false },
    ],
  },
  {
    name: 'Add-ons',
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
  //   {
  //     name: 'Devices',
  //     alarmTypes: [
  //       {
  //         name: 'Device offline',
  //         datapoints: 'PRESENT',
  //         type: 'device_offline',
  //         disabled: false,
  //         category: 'DEVICE',
  //       },
  //       {
  //         name: 'Battery low',
  //         datapoints: 'PRESENT',
  //         type: 'device_battery_low',
  //         disabled: false,
  //         category: 'DEVICE',
  //       },
  //       {
  //         name: 'Unavailable entities',
  //         datapoints: 'PRESENT',
  //         type: 'device_unavailable_entities',
  //         disabled: false,
  //         category: 'DEVICE',
  //       },
  //     ],
  //   },
  {
    name: 'Network',
    alarmTypes: [
      {
        name: 'Network down',
        datapoints: 'MISSING',
        type: 'network_down',
        disabled: false,
        category: 'NETWORK',
      },
      {
        name: 'High network latency',
        datapoints: 'PRESENT',
        type: 'network_high_latency',
        disabled: false,
        category: 'NETWORK',
      },
      {
        name: 'High network traffic',
        datapoints: 'PRESENT',
        type: 'network_high_traffic',
        disabled: false,
        category: 'NETWORK',
      },
    ],
  },
];

export async function getAlarmConfigurations(userId: string) {
  // Mark sections as disabled because they exist on user
  // TODO: If specific addons set up (multi select) just remove/dsiable the addon entry instead of the whole item
  // TODO: Return available sections from backend - first step: static data. second: filter by already set alarms

  //   const userAlarmConfigurations = await fetchUserAlarmConfigurations(userId);

  let configurations = staticConfigurations;

  // Maybe this is not needed at all for now. Focus on creating/modifying/triggering alarms for now.
  //   configurations.forEach(c => {
  //     c.alarmTypes.forEach(at => {
  //       // TODO: This is basic checking. if configuration is of addon-type, disable specific addons only. redo the type
  //       // to account for that

  //       if (userAlarmConfigurations.map(ac => ac.type).includes(at.type)) {
  //         at.disabled = true;
  //       }
  //     });
  //   });

  return configurations;
}

export interface UserAlarmConfiguration {
  type: string;
  category: AlarmCategory;
  configuration: {
    datapointCount?: number;
    addons?: { slug: string }[];
  };
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

  return response.Items ? (response.Items as UserAlarmConfiguration[]) : [];
}

export async function createAlarmConfiguration(
  userId: string,
  alarmConfiguration: UserAlarmConfiguration,
) {
  const id = require('crypto').randomUUID();

  const putParams = {
    TableName: process.env.ALARM_CONFIGURATION_TABLE,
    Item: {
      id: id,
      userId: userId,
      ...alarmConfiguration,
    },
  };
  await dynamoDbClient.send(new PutCommand(putParams));
}
