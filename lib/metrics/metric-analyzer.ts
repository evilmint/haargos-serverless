import { MeasureValueType, _Record } from '@aws-sdk/client-timestream-write';
import { createHash } from 'crypto';
import { z } from 'zod';
import {
  AlarmCategory,
  AlarmConfigurationType,
  UserAlarmConfiguration,
} from '../../services/static-alarm-configurations';
import { updateAddonsSchema } from '../zod/addons-schema';
import { updateLogsSchema } from '../zod/logs-schema';
import { observationSchema } from '../zod/observation-schema';
import { AlarmTextConditionValidator } from './condition-validators';
import createRecord from './create-record';
import MetricStore from './metric-store';

export interface InstallationPing {
  responseTimeInMilliseconds: number;
  isHealthy: boolean;
  hasHomeAssistantContent: boolean;
  installationId: string;
}

export default class MetricAnalyzer {
  private metricStore: MetricStore;

  constructor(metricStore: MetricStore) {
    this.metricStore = metricStore;
  }

  async analyzeLogsAndStoreMetrics(
    installationId: string,
    logsData: z.infer<typeof updateLogsSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
  ): Promise<void> {
    const records: _Record[] = [];

    // Pick alarms which match the current log
    const logUserAlarmConfigurations = userAlarmConfigurations.filter(config => {
      return (
        config.category === 'LOGS' &&
        (config.configuration?.logTypes ?? [])
          .map(l => l.logType)
          .includes(logsData.type as any)
      );
    });

    for (const configuration of logUserAlarmConfigurations) {
      if (!configuration.configuration.textCondition) {
        continue;
      }

      // Validate log against configuration
      const validatorConstraintsSatisfied = new AlarmTextConditionValidator(
        configuration.configuration.textCondition,
      ).isValid(logsData.content);

      if (validatorConstraintsSatisfied) {
        // Because logs can be huge, we are not storing the whole content.
        // Instead, we are creating a hash of the user log configuration
        // and that will be used in the metric analyzer
        const userConfigurationHash = createHash('md5')
          .update(JSON.stringify(configuration))
          .digest('base64');

        const logHash = createHash('md5').update(logsData.content).digest('base64');

        records.push(
          createRecord(
            installationId,
            `logs-${logHash}`,
            userConfigurationHash,
            new Date().getTime().toString(),
            'VARCHAR',
            [{ Name: 'id', Value: configuration.id }],
          ),
        );
      }
    }

    await this.metricStore.storeMetrics(records);
  }

  async analyzePingAndStoreMetrics(
    pingData: InstallationPing[],
    // userAlarmConfigurations: UserAlarmConfiguration[],
  ): Promise<void> {
    const records: _Record[] = [];

    for (const ping of pingData) {
      records.push(
        createRecord(
          ping.installationId,
          'ping',
          ping.responseTimeInMilliseconds.toFixed(0).toString(),
          new Date().getTime().toString(),
          'VARCHAR',
          [
            { Name: 'healthy', Value: ping.isHealthy.toString() },
            { Name: 'haContent', Value: ping.hasHomeAssistantContent.toString() },
          ],
        ),
      );
    }

    await this.metricStore.storeMetrics(records);
  }

  async analyzeAddonsAndStoreMetrics(
    installationId: string,
    addonData: z.infer<typeof updateAddonsSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
  ): Promise<void> {
    const records: _Record[] = [];

    this.checkAddonMetrics(installationId, addonData, userAlarmConfigurations, records);

    await this.metricStore.storeMetrics(records);
  }

  async analyzeObservationAndStoreMetrics(
    observationData: z.infer<typeof observationSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
  ): Promise<void> {
    const records: _Record[] = [];

    this.checkCoreMetrics(observationData, userAlarmConfigurations, records);
    this.checkZigbeeMetrics(observationData, userAlarmConfigurations, records);

    await this.metricStore.storeMetrics(records);
  }

  private checkCoreMetrics(
    observationData: z.infer<typeof observationSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
    records: _Record[],
  ): void {
    if (this.containsAlarmsOfType(userAlarmConfigurations, 'host_cpu_usage')) {
      records.push(this.createCpuUsageRecord(observationData));
    }

    if (
      this.containsAlarmsOfType(userAlarmConfigurations, 'host_memory_usage') &&
      observationData.environment.memory &&
      observationData.environment.memory.total != 0
    ) {
      const memory = observationData.environment.memory;

      records.push(
        createRecord(
          observationData.installation_id,
          'host_memory_usage',
          ((memory.free / memory.total) * 100.0).toFixed(0).toString(),
          new Date().getTime().toString(),
          'DOUBLE',
        ),
      );
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'host_disk_usage')) {
      const alarmStorages = userAlarmConfigurations
        .filter(a => a.configuration.storages != null)
        .flatMap(a => a.configuration.storages!)
        .flatMap(a => a.name);

      const observationStorages = observationData.environment.storage.filter(s =>
        alarmStorages.includes(s.name),
      );

      let pushedNames: string[] = [];

      for (const storage of observationStorages) {
        if (pushedNames.includes(storage.name)) {
          continue;
        }

        records.push(
          createRecord(
            observationData.installation_id,
            'host_disk_usage',
            storage.use_percentage.substring(0, storage.use_percentage.length - 1),
            new Date().getTime().toString(),
            'DOUBLE',
            [{ Name: 'name', Value: storage.name }],
          ),
        );

        pushedNames.push(storage.name);
      }
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'scene_last_trigger_older_than')) {
      const alarmScenes = userAlarmConfigurations
        .filter(a => a.configuration.scenes != null)
        .flatMap(a => a.configuration.scenes!)
        .flatMap(a => a.id);

      const observationScenes = (observationData.scenes ?? []).filter(s =>
        alarmScenes.includes(s.id),
      );

      for (const scene of observationScenes) {
        if (!scene.state) {
          continue;
        }

        records.push(
          createRecord(
            observationData.installation_id,
            'scene_last_trigger_older_than',
            scene.state,
            new Date().getTime().toString(),
            'VARCHAR',
            [{ Name: 'id', Value: scene.id }],
          ),
        );
      }
    }

    if (
      this.containsAlarmsOfType(userAlarmConfigurations, 'automation_last_trigger_older_than')
    ) {
      const alarmAutomations = userAlarmConfigurations
        .filter(a => a.configuration.automations != null)
        .flatMap(a => a.configuration.automations!)
        .flatMap(a => a.id);

      const observationAutomations = (observationData.automations ?? []).filter(s =>
        alarmAutomations.includes(s.id),
      );

      for (const automation of observationAutomations) {
        if (!automation.last_triggered) {
          continue;
        }

        records.push(
          createRecord(
            observationData.installation_id,
            'automation_last_trigger_older_than',
            automation.last_triggered,
            new Date().getTime().toString(),
            'VARCHAR',
            [{ Name: 'id', Value: automation.id }],
          ),
        );
      }
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'script_last_trigger_older_than')) {
      const alarmScripts = userAlarmConfigurations
        .filter(a => a.configuration.scripts != null)
        .flatMap(a => a.configuration.scripts!)
        .flatMap(a => a.alias);

      const observationScripts = (observationData.scripts ?? []).filter(s =>
        alarmScripts.includes(s.alias),
      );

      for (const script of observationScripts) {
        if (!script.last_triggered || script.last_triggered === '0001-01-01T00:00:00Z') {
          continue;
        }

        records.push(
          createRecord(
            observationData.installation_id,
            'script_last_trigger_older_than',
            script.last_triggered,
            new Date().getTime().toString(),
            'VARCHAR',
            [{ Name: 'alias', Value: script.alias }],
          ),
        );
      }
    }
  }

  private checkAddonMetrics(
    installationId: string,
    addonData: z.infer<typeof updateAddonsSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
    records: _Record[],
  ): void {
    if (this.containsAlarmsOfType(userAlarmConfigurations, 'addon_update_available')) {
      const alarmAddons = userAlarmConfigurations
        .filter(a => a.configuration.addons != null)
        .flatMap(a => a.configuration.addons!)
        .flatMap(a => a.slug);

      const observationAddons = addonData.filter(
        s => alarmAddons.includes(s.name) && s.update_available,
      );

      for (const addon of observationAddons) {
        records.push(
          createRecord(
            installationId,
            'addon_update_available',
            addon.update_available.toString(),
            new Date().getTime().toString(),
            'BOOLEAN',
            [{ Name: 'addon_slug', Value: addon.slug }],
          ),
        );
      }
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'addon_stopped')) {
      const alarmAddons = userAlarmConfigurations
        .filter(a => a.configuration.addons != null)
        .flatMap(a => a.configuration.addons!)
        .flatMap(a => a.slug);

      const observationAddons = addonData.filter(
        s => alarmAddons.includes(s.name) && s.state === 'stopped',
      );

      for (const addon of observationAddons) {
        records.push(
          createRecord(
            installationId,
            'addon_stopped',
            addon.state,
            new Date().getTime().toString(),
            'VARCHAR',
            [{ Name: 'addon_slug', Value: addon.slug }],
          ),
        );
      }
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'addon_cpu_usage')) {
      const alarmAddons = userAlarmConfigurations
        .filter(a => a.configuration.addons != null)
        .flatMap(a => a.configuration.addons!)
        .flatMap(a => a.slug);

      const observationAddons = addonData.filter(s => alarmAddons.includes(s.name));

      for (const addon of observationAddons) {
        if (!addon.stats) {
          continue;
        }

        records.push(
          createRecord(
            installationId,
            'addon_cpu_usage',
            addon.stats.cpu_percent.toString(),
            new Date().getTime().toString(),
            'DOUBLE',
            [{ Name: 'addon_slug', Value: addon.slug }],
          ),
        );
      }
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'addon_memory_usage')) {
      const alarmAddons = userAlarmConfigurations
        .filter(a => a.configuration.addons != null)
        .flatMap(a => a.configuration.addons!)
        .flatMap(a => a.slug);

      const observationAddons = addonData.filter(s => alarmAddons.includes(s.slug));

      for (const addon of observationAddons) {
        if (!addon.stats) {
          continue;
        }

        records.push(
          createRecord(
            installationId,
            'addon_memory_usage',
            addon.stats.memory_percent.toString(),
            new Date().getTime().toString(),
            'DOUBLE',
            [{ Name: 'addon_slug', Value: addon.slug }],
          ),
        );
      }
    }
  }

  private checkZigbeeMetrics(
    observationData: z.infer<typeof observationSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
    records: _Record[],
  ): void {
    if (this.containsAlarmsOfCategory(userAlarmConfigurations, 'ZIGBEE')) {
      const zigbeeDevicesInAlarms = userAlarmConfigurations
        .filter(a => a.configuration.zigbee != null)
        .flatMap(a => a.configuration.zigbee!)
        .flatMap(a => a.ieee);

      const zigbeeObservationDevices =
        observationData.zigbee?.devices.filter(d => zigbeeDevicesInAlarms.includes(d.ieee)) ??
        [];

      for (const device of zigbeeObservationDevices) {
        records.push(
          this.createZigbeeRecord(
            observationData.installation_id,
            'zig_lqi',
            device.ieee,
            device.lqi.toString(),
            'DOUBLE',
          ),
        );

        if (device.battery_level) {
          records.push(
            this.createZigbeeRecord(
              observationData.installation_id,
              'zig_battery',
              device.ieee,
              device.battery_level,
              'DOUBLE',
            ),
          );
        }

        records.push(
          this.createZigbeeRecord(
            observationData.installation_id,
            'zig_last_updated',
            device.ieee,
            device.last_updated,
            'VARCHAR',
          ),
        );
      }
    }
  }

  private createCpuUsageRecord(observationData: z.infer<typeof observationSchema>): any {
    return createRecord(
      observationData.installation_id,
      'cpu_usage',
      (observationData.environment.cpu?.load ?? 0).toString(),
      new Date().getTime().toString(),
      'DOUBLE',
    );
  }

  private createZigbeeRecord(
    installationId: string,
    metricName: string,
    ieee: string,
    metric: any,
    recordType: MeasureValueType,
  ): _Record {
    return createRecord(
      installationId,
      metricName,
      metric,
      new Date().getTime().toString(),
      recordType,
      [{ Name: 'ieee', Value: ieee }],
    );
  }

  private containsAlarmsOfType(
    configurations: UserAlarmConfiguration[],
    type: AlarmConfigurationType,
  ): boolean {
    return configurations.filter(c => c.type == type).length > 0;
  }

  private containsAlarmsOfCategory(
    configurations: UserAlarmConfiguration[],
    category: AlarmCategory,
  ): boolean {
    return configurations.filter(c => c.category == category).length > 0;
  }
}
