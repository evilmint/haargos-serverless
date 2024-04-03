import {
  QueryCommand,
  QueryCommandOutput,
  Row,
  TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query';
import moment, { unitOfTime } from 'moment';
import * as R from 'ramda';
import { updateUserAlarmConfigurationState } from '../../services/alarm-service';
import {
  UserAlarmConfiguration,
  UserAlarmConfigurationState,
} from '../../services/static-alarm-configurations';
import { insertTrigger } from '../../services/trigger-service';
import { InstallationPing, haConfigVersionToNumber } from './metric-collector';
import { TimestreamQueryBuilder } from './query-builder';
const asc = arr => arr.sort((a, b) => a - b);

const sum = arr => arr.reduce((a, b) => a + b, 0);

const mean = arr => sum(arr) / arr.length;

// sample standard deviation
const std = arr => {
  const mu = mean(arr);
  const diffArr = arr.map(a => (a - mu) ** 2);
  return Math.sqrt(sum(diffArr) / (arr.length - 1));
};

const quantile = (arr, q) => {
  const sorted = asc(arr);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
};

const q25 = arr => quantile(arr, 0.25);

const q50 = arr => quantile(arr, 0.5);

const q75 = arr => quantile(arr, 0.75);
const q90 = arr => quantile(arr, 0.9);

const median = arr => q50(arr);

type MeasureValueOutput = {
  varcharValue: string | null;
  doubleValue: number | null;
};

type MetricAnalysisType = 'observation' | 'addon' | 'log' | 'ping';
type MetricType = 'numeric' | 'log' | 'ping' | 'existence' | 'age';
type SelectionType = 'count' | 'measure_values' | 'last_triggered';

class MetricAnalyzer {
  private timestreamWriteClient: TimestreamQueryClient;
  private databaseName: string;
  private tableName: string;

  private _latestHAVersion: string | null = null;

  public get latestHAVersion(): string | null {
    return this._latestHAVersion;
  }

  public set latestHAVersion(value: string | null) {
    this._latestHAVersion = value;
  }

  constructor(
    private userAlarmConfigurations: UserAlarmConfiguration[],
    region: string,
    databaseName: string,
    tableName: string,
  ) {
    this.timestreamWriteClient = new TimestreamQueryClient({ region: region });
    this.databaseName = databaseName;
    this.tableName = tableName;
  }

  async analyzeObservationMetricsAndCreateTriggers(installationId: string): Promise<void> {
    await this.analyzeMetricsAndCreateTriggers(
      installationId,
      'observation',
      this.userAlarmConfigurations,
    );
  }

  async analyzePingMetricsAndCreateTriggers(installationPings: InstallationPing[]): Promise<void> {
    const pingConfigurations = this.userAlarmConfigurations.filter(c => c.category === 'PING');

    for (const installationPing of installationPings) {
      await this.analyzeMetricsAndCreateTriggers(
        installationPing.installationId,
        'ping',
        pingConfigurations,
      );
    }
  }

  async analyzeLogMetricsAndCreateTriggers(installationId: string): Promise<void> {
    await this.analyzeMetricsAndCreateTriggers(
      installationId,
      'log',
      this.userAlarmConfigurations.filter(c => c.category === 'LOGS'),
    );
  }

  async analyzeAddonMetricsAndCreateTriggers(installationId: string): Promise<void> {
    await this.analyzeMetricsAndCreateTriggers(
      installationId,
      'addon',
      this.userAlarmConfigurations.filter(c => c.category === 'ADDON'),
    );
  }

  private async analyzeMetricsAndCreateTriggers(
    installationId: string,
    metricAnalysisType: MetricAnalysisType,
    userAlarmConfigurations: UserAlarmConfiguration[],
  ): Promise<void> {
    for (const config of userAlarmConfigurations) {
      const metricName = config.type;

      // TODO: Think how this can be added to the query builder
      let metricType: MetricType = this.metricTypeByConfiguration(config);

      let command: QueryCommand;
      let commandBuilder = new TimestreamQueryBuilder();

      if (metricType === 'age') {
        const ids = (config.configuration.scripts ?? [])
          .map(s => s.unique_id)
          .concat((config.configuration.scenes ?? []).map(s => s.id))
          .concat((config.configuration.automations ?? []).map(s => s.id));

        command = commandBuilder.buildLastTrigger(
          this.databaseName,
          this.tableName,
          installationId,
          ids,
        );
      } else if (config.type === 'ha_new_version') {
        command = commandBuilder.buildHANewVersion(
          this.databaseName,
          this.tableName,
          installationId,
          haConfigVersionToNumber(this._latestHAVersion ?? '2015.0.0').toString(),
        );
      } else {
        let countColumnName: string | null;
        let selectionType: SelectionType;

        if (
          config.type === 'frontend_bad_content' ||
          config.type === 'frontend_ping_unresponsive'
        ) {
          selectionType = 'count';
          countColumnName = 'healthy';
        } else if (config.type === 'addon_stopped' || config.type === 'addon_update_available') {
          selectionType = 'count';
          countColumnName = 'measure_name';
        } else if (metricType === 'existence') {
          selectionType = 'count';
          countColumnName = 'healthy';
        } else {
          selectionType = 'measure_values';
        }

        let select: string;

        switch (selectionType) {
          case 'count':
            select = `COUNT(${countColumnName!}) as dval, '' as vval`;
          case 'measure_values':
            select = 'measure_value::double as dval, measure_value::varchar as vval';
        }

        if (config.type === 'zigbee_device_lqi') {
          select = `lqi as dval, '' as vval`;
        } else if (config.type === 'zigbee_device_battery_percentage') {
          select = `battery_level as dval, '' as vval`;
        }

        commandBuilder = commandBuilder
          .selectFrom(this.databaseName, this.tableName, select)
          .whereInstallationId(installationId);

        if (metricAnalysisType === 'addon') {
          commandBuilder = commandBuilder
            .constrainToAddons(config.configuration.addons ?? [])
            .whereMetricName('addon');

          if (config.type === 'addon_stopped') {
            commandBuilder = commandBuilder.andCondition('state = "stopped"');
          } else if (config.type === 'addon_update_available') {
            commandBuilder = commandBuilder.andCondition('update_available = "true"');
          }
        } else if (metricAnalysisType === 'observation') {
          if (
            config.type === 'zigbee_device_battery_percentage' ||
            config.type === 'zigbee_device_lqi'
          ) {
            commandBuilder = commandBuilder
              .constrainToZigbeeDevices(config.configuration.zigbee ?? [])
              .whereMetricName('zigbee_device');
          } else {
            commandBuilder = commandBuilder
              .constrainToAutomations(config.configuration.automations ?? [])
              .constrainToScripts(config.configuration.scripts ?? [])
              .constrainToScenes(config.configuration.scenes ?? [])
              .constrainToStorages(config.configuration.storages ?? [])
              .whereMetricName(metricName);
          }
        } else if (metricAnalysisType === 'log') {
          commandBuilder = commandBuilder.constrainToLogTypesOfConfiguration(config.id);
        } else if (metricAnalysisType === 'ping') {
          commandBuilder = commandBuilder.whereMetricName('ping_fixed');

          if (config.type === 'frontend_bad_content') {
            commandBuilder = commandBuilder.andCondition("haContent = 'false'");
          } else if (config.type === 'frontend_ping_unresponsive') {
            commandBuilder = commandBuilder.andCondition("healthy = 'false'");
          }
        }

        commandBuilder = commandBuilder.betweenTime(
          process.env.ALARM_METRIC_RETENTION_PERIOD as string,
        );

        if (selectionType !== 'count') {
          commandBuilder = commandBuilder.orderByTimeDesc();
        }

        command = commandBuilder.limit(config.configuration.datapointCount ?? 1).build();
      }

      try {
        const result = await this.timestreamWriteClient.send(command);
        const measureValues = this.measureValuesFromQueryOutput(result);

        const minimumDatapoints = config.configuration.datapointCount;
        if (minimumDatapoints && measureValues.length < minimumDatapoints) {
          continue;
        }

        if (measureValues.length > 0) {
          let isTriggered: boolean;

          switch (metricType) {
            case 'numeric':
              isTriggered = this.evaluateNumericMetricsAgainstConfiguration(measureValues, config);
              break;
            case 'log':
              isTriggered = this.evaluateLogMetricsAgainstConfiguration(measureValues, config);
              break;
            case 'ping':
              isTriggered = this.evaluatePingMetricsAgainstConfiguration(measureValues, config);
              break;
            case 'existence':
              isTriggered = this.evaluateExistenceMetricsAgainstConfiguration(measureValues);
              break;
            case 'age':
              isTriggered = this.evaluateAgeMetricsAgainstConfiguration(measureValues, config);
              break;
            default:
              isTriggered = false;
              break;
          }

          const didAlarmChangeState =
            config.state == 'NO_DATA' ||
            (config.state == 'IN_ALARM' && !isTriggered) ||
            (config.state == 'OK' && isTriggered);

          if (isTriggered) {
            console.error(
              `Triggered configuration ${config.id} - ${
                config.name
              } didAlarmChangeState ${didAlarmChangeState} will insert ${
                config.state !== 'NO_DATA' || (config.state === 'NO_DATA' && isTriggered)
              }`,
            );
          }

          if (didAlarmChangeState) {
            const newAlarmState: UserAlarmConfigurationState = isTriggered ? 'IN_ALARM' : 'OK';

            // Don't create a trigger when state goes from NO_DATA to OK
            if (config.state !== 'NO_DATA' || (config.state === 'NO_DATA' && isTriggered)) {
              await insertTrigger(
                installationId,
                config.user_id,
                new Date(),
                config.id,
                newAlarmState,
              );
            }

            await updateUserAlarmConfigurationState(
              config.user_id,
              config.created_at,
              newAlarmState,
            );
          }
        }
      } catch (error) {
        console.error(
          `Error executing query (${command.input.QueryString}) for metric ${metricName}: ${error}`,
        );
      }
    }
  }

  private measureValuesFromQueryOutput(result: QueryCommandOutput): MeasureValueOutput[] {
    return (
      result.Rows?.map((row: Row) => ({
        doubleValue: row.Data?.[0].ScalarValue ? parseFloat(row.Data[0].ScalarValue) : null,
        varcharValue: row.Data?.[1].ScalarValue ?? null,
      })) ?? []
    );
  }

  private evaluateLogMetricsAgainstConfiguration(
    values: MeasureValueOutput[],
    config: UserAlarmConfiguration,
  ): boolean {
    return (config.configuration.datapointCount ?? 0) <= values.length;
  }

  private evaluateAgeMetricsAgainstConfiguration(
    values: MeasureValueOutput[],
    config: UserAlarmConfiguration,
  ): boolean {
    if (!config.configuration.olderThan) {
      console.error(`Analysing age early return olderThan ${config.type}`);
      return false;
    }
    if (values.length === 0) {
      console.error(`Analysing age early return varcharValue ${config.type}`);
      return false;
    }

    // If there are no results - this will result in an empty varchar
    if (!values[0].varcharValue) {
      return true;
    }

    // Trigger on stale script immediately. This date is resolved to `now` when construted in new Date(...)
    if (values[0].varcharValue.trim() == '0001-01-01T00:00:00Z') {
      return true;
    }

    const duration =
      config.configuration.olderThan.timeComponent.toLocaleLowerCase() as unitOfTime.DurationConstructor;

    const compareDate = moment(new Date(values[0].varcharValue))
      .add(config.configuration.olderThan.componentValue, duration)
      .toDate();

    return new Date() > compareDate;
  }

  private evaluateExistenceMetricsAgainstConfiguration(values: MeasureValueOutput[]): boolean {
    if (values.length === 0) {
      return true;
    }

    return (values[0].doubleValue ?? 0) > 0;
  }

  private evaluatePingMetricsAgainstConfiguration(
    values: MeasureValueOutput[],
    config: UserAlarmConfiguration,
  ): boolean {
    switch (config.type) {
      case 'frontend_ping_unresponsive':
      case 'frontend_bad_content':
        return values.length === 0;

      case 'frontend_ping_latency':
        return this.evaluateNumericMetricsAgainstConfiguration(values, config);

      default:
        console.error(`Evaluating bad ping type: ${config.type}`);
        break;
    }
    return false;
  }

  private evaluateNumericMetricsAgainstConfiguration(
    values: MeasureValueOutput[],
    config: UserAlarmConfiguration,
  ): boolean {
    if (values.length === 0) {
      return true;
    }

    const ltGtThan = config.configuration.ltGtThan;
    const statFunction = config.configuration.statFunction;

    if (ltGtThan && statFunction) {
      let compared: number;

      if (values.length == 1) {
        compared = values[0].doubleValue ?? 0;
      } else {
        const doubleValues = R.pipe(
          R.map((v: MeasureValueOutput) => v.doubleValue),
          R.reject(R.isNil),
        )(values);

        switch (statFunction.function) {
          case 'avg':
            compared = mean(doubleValues);
            break;
          case 'min':
            compared = Math.min(...doubleValues);
            break;
          case 'max':
            compared = Math.max(...doubleValues);
            break;
          case 'median':
            compared = median(doubleValues);
            break;
          case 'p90':
            compared = q90(doubleValues);
            break;
          case 'sum':
            compared = sum(doubleValues);
            break;
        }
      }

      switch (ltGtThan.comparator) {
        case 'lt':
          return compared < ltGtThan.value;
        case 'gt':
          return compared > ltGtThan.value;
        case 'lte':
          return compared <= ltGtThan.value;
        case 'gte':
          return compared >= ltGtThan.value;
      }
    }

    return false;
  }

  private metricTypeByConfiguration(config: UserAlarmConfiguration) {
    let metricType: MetricType;

    switch (config.type) {
      case 'addon_cpu_usage':
      case 'addon_memory_usage':
      case 'host_disk_usage':
      case 'host_memory_usage':
      case 'host_cpu_usage':
      case 'zigbee_device_battery_percentage':
      case 'zigbee_device_lqi':
        metricType = 'numeric';
        break;

      case 'ping':
      case 'frontend_bad_content':
      case 'frontend_ping_latency':
      case 'frontend_ping_unresponsive':
        metricType = 'ping';
        break;

      case 'automation_last_trigger_older_than':
      case 'zigbee_last_updated_older_than':
      case 'scene_last_trigger_older_than':
      case 'script_last_trigger_older_than':
        metricType = 'age';
        break;

      case 'addon_stopped':
      case 'addon_update_available':
      case 'ha_new_version':
        metricType = 'existence';
        break;

      case 'logs_contain_string':
        metricType = 'log';
        break;
    }
    return metricType;
  }
}

export default MetricAnalyzer;
