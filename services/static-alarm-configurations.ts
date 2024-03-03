export const staticConfigurations: AlarmConfiguration[] = [
  {
    name: 'HomeAssistant Core',
    requires_supervisor: false,
    alarmTypes: [
      {
        name: 'Ping unavailable',
        datapoints: 'MISSING',
        type: 'ha_ping_unavailability',
        disabled: false,
        category: 'CORE',
      },
      {
        name: 'Memory usage',
        datapoints: 'PRESENT',
        type: 'host_memory_usage',
        disabled: false,
        category: 'CORE',
      },
      {
        name: 'CPU usage',
        datapoints: 'PRESENT',
        type: 'host_cpu_usage',
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
        name: 'Disk usage',
        datapoints: 'PRESENT',
        type: 'host_disk_usage',
        disabled: false,
        category: 'CORE',
      },
      {
        name: 'Automation last trigger',
        datapoints: 'PRESENT',
        type: 'automations_last_trigger_older_than',
        disabled: false,
        category: 'AUTOMATIONS',
        components: [{ type: 'older_than_picker' }],
      },
      {
        name: 'Scene last trigger',
        datapoints: 'PRESENT',
        type: 'automations_last_trigger_older_than',
        disabled: false,
        category: 'SCENES',
        components: [{ type: 'older_than_picker' }],
      },
      {
        name: 'Script last trigger',
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
        name: 'Addon stopped',
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
        name: 'Addon CPU usage',
        datapoints: 'PRESENT',
        type: 'addon_cpu_usage',
        disabled: false,
        category: 'ADDON',
      },
      {
        name: 'Addon memory usage',
        datapoints: 'PRESENT',
        type: 'addon_memory_usage',
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
        name: 'Device LQI',
        datapoints: 'PRESENT',
        type: 'zigbee_device_lqi',
        disabled: false,
        category: 'ZIGBEE',
      },
      {
        name: 'Last updated more than',
        datapoints: 'PRESENT',
        type: 'zigbee_last_updated_older_than',
        disabled: false,
        category: 'ZIGBEE',
        components: [{ type: 'older_than_picker' }],
      },
      {
        name: 'Zigbee device battery',
        datapoints: 'PRESENT',
        type: 'zigbee_device_battery_percentage',
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

export interface AlarmConfiguration {
  name: string;
  requires_supervisor: boolean;
  alarmTypes: AlarmType[];
}

export type TimeComponent = 'Months' | 'Days' | 'Hours' | 'Minutes';

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
