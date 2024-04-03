import { Dimension, _Record } from '@aws-sdk/client-timestream-write';
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
  startDate: Date | null;
  userId: string | undefined;
}

export default class MetricCollector {
  private metricStore: MetricStore;

  constructor(metricStore: MetricStore) {
    this.metricStore = metricStore;
  }

  async analyzeLogsAndStoreMetrics(
    installationId: string,
    logsData: z.infer<typeof updateLogsSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
    date: Date,
  ): Promise<void> {
    const records: _Record[] = [];

    // Pick alarms which match the current log
    const logUserAlarmConfigurations = userAlarmConfigurations.filter(config => {
      return (
        config.category === 'LOGS' &&
        (config.configuration?.logTypes ?? []).map(l => l.logType).includes(logsData.type as any)
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
            date.getTime().toString(),
            'VARCHAR',
            [{ Name: 'id', Value: configuration.id }],
          ),
        );
      }
    }

    await this.metricStore.storeMetrics(records);
  }

  async analyzePingAndStoreMetrics(pingData: InstallationPing[]): Promise<void> {
    const records: _Record[] = [];

    for (const ping of pingData) {
      records.push(
        createRecord(
          ping.installationId,
          'ping_fixed',
          ping.responseTimeInMilliseconds.toFixed(0).toString(),
          (ping.startDate ?? new Date()).getTime().toString(),
          'DOUBLE',
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
    date: Date,
  ): Promise<void> {
    const records: _Record[] = [];

    this.checkAddonMetrics(installationId, addonData, userAlarmConfigurations, records, date);

    await this.metricStore.storeMetrics(records);
  }

  async analyzeObservationAndStoreMetrics(
    observationData: z.infer<typeof observationSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
    date: Date,
  ): Promise<void> {
    const records: _Record[] = [];

    this.checkCoreMetrics(observationData, userAlarmConfigurations, records, date);
    this.checkZigbeeMetrics(observationData, userAlarmConfigurations, records, date);

    await this.metricStore.storeMetrics(records);
  }

  private checkCoreMetrics(
    observationData: z.infer<typeof observationSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
    records: _Record[],
    date: Date,
  ): void {
    if (observationData.ha_config?.version) {
      records.push(
        createRecord(
          observationData.installation_id,
          'ha_version',
          haConfigVersionToNumber(observationData.ha_config.version).toString(),
          date.getTime().toString(),
          'DOUBLE',
        ),
      );
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'host_cpu_usage')) {
      records.push(
        createRecord(
          observationData.installation_id,
          'host_cpu_usage',
          (observationData.environment.cpu?.load ?? 0).toString(),
          date.getTime().toString(),
          'DOUBLE',
        ),
      );
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
          date.getTime().toString(),
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
            date.getTime().toString(),
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
            'scene',
            scene.id,
            date.getTime().toString(),
            'VARCHAR',
            [
              { Name: 'id', Value: scene.id },
              { Name: 'last_triggered', Value: scene.state },
            ],
          ),
        );
      }
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'automation_last_trigger_older_than')) {
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
            'automation',
            automation.id,
            date.getTime().toString(),
            'VARCHAR',
            [
              { Name: 'id', Value: automation.id },
              { Name: 'last_triggered', Value: automation.last_triggered },
            ],
          ),
        );
      }
    }

    if (this.containsAlarmsOfType(userAlarmConfigurations, 'script_last_trigger_older_than')) {
      const alarmScripts = userAlarmConfigurations
        .filter(a => a.configuration.scripts != null)
        .flatMap(a => a.configuration.scripts!)
        .flatMap(a => a.unique_id);

      const observationScripts = (observationData.scripts ?? []).filter(
        s => alarmScripts.includes(s.unique_id ?? ';;;;;'), // TODO: Fix
      );

      for (const script of observationScripts) {
        if (!script.last_triggered || !script.unique_id) {
          continue;
        }

        records.push(
          createRecord(
            observationData.installation_id,
            'script',
            script.unique_id,
            date.getTime().toString(),
            'VARCHAR',
            [
              { Name: 'id', Value: script.unique_id },
              { Name: 'last_triggered', Value: script.last_triggered },
            ],
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
    date: Date,
  ): void {
    // Filter addons that are part of any alarm configuration
    const alarmAddonSlugs = userAlarmConfigurations
      .filter(config => config.configuration.addons)
      .flatMap(config => config.configuration.addons)
      .map(addon => addon?.slug)
      .filter(slug => !!slug)
      .map(slug => slug!);

    addonData
      .filter(addon => alarmAddonSlugs.includes(addon.slug))
      .forEach(addon => {
        const dimensions: Dimension[] = [];

        dimensions.push({ Name: 'update_available', Value: addon.update_available.toString() });
        dimensions.push({ Name: 'state', Value: addon.state });

        if (addon.stats) {
          dimensions.push({ Name: 'cpu_usage', Value: addon.stats.cpu_percent.toString() });
          dimensions.push({ Name: 'memory_usage', Value: addon.stats.memory_percent.toString() });
        }

        records.push(
          createRecord(
            installationId,
            'addon',
            addon.slug,
            date.getTime().toString(),
            'VARCHAR',
            dimensions,
          ),
        );
      });
  }

  private checkZigbeeMetrics(
    observationData: z.infer<typeof observationSchema>,
    userAlarmConfigurations: UserAlarmConfiguration[],
    records: _Record[],
    date: Date,
  ): void {
    if (!this.containsAlarmsOfCategory(userAlarmConfigurations, 'ZIGBEE')) {
      return;
    }
    const zigbeeDevicesInAlarms = userAlarmConfigurations
      .filter(a => !!a.configuration.zigbee)
      .flatMap(a => a.configuration.zigbee!)
      .flatMap(a => a.ieee);

    const zigbeeObservationDevices =
      observationData.zigbee?.devices.filter(d => zigbeeDevicesInAlarms.includes(d.ieee)) ?? [];

    zigbeeObservationDevices.forEach(device => {
      const dimensions: Dimension[] = [{ Name: 'ieee', Value: device.ieee }];

      dimensions.push({ Name: 'lqi', Value: device.lqi.toString() });
      dimensions.push({ Name: 'battery_level', Value: (device.battery_level ?? 0).toString() });
      dimensions.push({ Name: 'last_updated', Value: device.last_updated });

      records.push(
        createRecord(
          observationData.installation_id,
          'zigbee_device',
          device.ieee,
          date.getTime().toString(),
          'VARCHAR',
          dimensions,
        ),
      );
    });
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

export function haConfigVersionToNumber(version: string): number {
  return parseInt(version.replace(/\./g, ''));
}
