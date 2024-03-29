import { Row, TimestreamQueryClient } from '@aws-sdk/client-timestream-query';
import { max, mean, median, min, sum } from 'mathjs';
import moment from 'moment';
import percentile from 'percentile';
import * as R from 'ramda';
import { updateUserAlarmConfigurationState } from '../../services/alarm-service';
import {
  UserAlarmConfiguration,
  UserAlarmConfigurationState,
} from '../../services/static-alarm-configurations';
import { insertTrigger } from '../../services/trigger-service';
import { InstallationPing } from './metric-collector';
import { TimestreamQueryBuilder } from './query-builder';

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
    // TODO: Limit to observation metrics
    await this.analyzeMetricsAndCreateTriggers(installationId, 'observation');
  }

  async analyzePingMetricsAndCreateTriggers(installationPings: InstallationPing[]): Promise<void> {
    for (const installationPing of installationPings) {
      await this.analyzeMetricsAndCreateTriggers(installationPing.installationId, 'ping');
    }
  }

  async analyzeLogMetricsAndCreateTriggers(installationId: string): Promise<void> {
    // TODO: Limit to log metrics
    await this.analyzeMetricsAndCreateTriggers(installationId, 'log');
  }

  async analyzeAddonMetricsAndCreateTriggers(installationId: string): Promise<void> {
    // TODO: Limit to addon metrics
    await this.analyzeMetricsAndCreateTriggers(installationId, 'addon');
  }

  private async analyzeMetricsAndCreateTriggers(
    installationId: string,
    metricAnalysisType: MetricAnalysisType,
  ): Promise<void> {
    let filteredConfigurations = this.userAlarmConfigurations;

    if (metricAnalysisType === 'log') {
      filteredConfigurations = filteredConfigurations.filter(c => c.category === 'LOGS');
    } else if (metricAnalysisType === 'addon') {
      filteredConfigurations = filteredConfigurations.filter(c => c.category === 'ADDON');
    } else if (metricAnalysisType === 'ping') {
      filteredConfigurations = filteredConfigurations.filter(c => c.category === 'PING');
    }

    for (const config of filteredConfigurations) {
      const metricName = config.type;

      let select: string;

      // TODO: Think how this can be added to the query builder
      let metricType: MetricType = this.metricTypeByConfiguration(config);

      let countColumnName: string | null;
      let selectionType: SelectionType;

      // TODO: Existence should also group by using COUNT(...). HA new version, addon update available, ha addon stopped

      if (config.type == 'frontend_bad_content' || config.type == 'frontend_ping_unresponsive') {
        selectionType = 'count';
        countColumnName = 'healthy';
      } else if (metricType == 'existence') {
        selectionType = 'count';
        countColumnName = 'healthy';
      } else if (metricType == 'age') {
        selectionType = 'last_triggered';
      } else {
        selectionType = 'measure_values';
      }

      switch (selectionType) {
        case 'count':
          select = `COUNT(${countColumnName!}) as dval, '' as vval`;
        case 'measure_values':
          select = 'measure_value::double as dval, measure_value::varchar as vval';
        case 'last_triggered':
          select = `0 as dval, last_triggered`;
      }

      let commandBuilder = new TimestreamQueryBuilder()
        .selectFrom(this.databaseName, this.tableName, select)
        .whereInstallationId(installationId);

      if (metricAnalysisType == 'addon') {
        commandBuilder = commandBuilder
          .constrainToAddons(config.configuration.addons ?? [])
          .whereMetricName('addon');
      } else if (metricAnalysisType === 'observation') {
        commandBuilder = commandBuilder
          .constrainToZigbeeDevices(config.configuration.zigbee ?? [])
          .constrainToAutomations(config.configuration.automations ?? [])
          .constrainToScripts(config.configuration.scripts ?? [])
          .constrainToScenes(config.configuration.scenes ?? [])
          .constrainToStorages(config.configuration.storages ?? []);

        if (selectionType !== 'last_triggered') {
          commandBuilder = commandBuilder.whereMetricName(metricName);
        }
      } else if (metricAnalysisType === 'log') {
        commandBuilder = commandBuilder.constrainToLogTypesOfConfiguration(config.id);
      } else if (metricAnalysisType === 'ping') {
        commandBuilder = commandBuilder.whereMetricName('ping_fixed');

        if (config.type == 'frontend_bad_content') {
          commandBuilder = commandBuilder.andCondition("haContent = 'false'");
        } else if (config.type == 'frontend_ping_unresponsive') {
          commandBuilder = commandBuilder.andCondition("healthy = 'false'");
        }
      }

      commandBuilder = commandBuilder.betweenTime('8h');

      if (selectionType !== 'count') {
        commandBuilder = commandBuilder.orderByTimeDesc();
      }

      const command = commandBuilder.limit(config.configuration.datapointCount ?? 1).build();

      try {
        const result = await this.timestreamWriteClient.send(command);

        const measureValues: MeasureValueOutput[] =
          result.Rows?.map((row: Row) => ({
            doubleValue: row.Data?.[0].ScalarValue ? parseFloat(row.Data[0].ScalarValue) : null,
            varcharValue: row.Data?.[1].ScalarValue ?? null,
          })) ?? [];

        if (metricType === 'age') {
          console.error(
            `Rows: ${JSON.stringify(result.Rows?.[0].Data)} Query: ${command.input.QueryString}`,
          );
        }

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
              isTriggered = false; // this.evaluateExistenceMetricsAgainstConfiguration(measureValues, config);
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
              await insertTrigger(installationId, new Date(), config.id, newAlarmState);
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
    if (values.length === 0 || !values[0].varcharValue) {
      console.error(`Analysing age early return varcharValue ${config.type}`);
      return false;
    }

    // Trigger on stale script immediately. This date is resolved to `now` when construted in new Date(...)
    if (values[0].varcharValue.trim() == '0001-01-01T00:00:00Z') {
      console.error(`${values[0].varcharValue.trim()} is stale. TRIGGER`);
      return true;
    } else {
      console.error(`${values[0].varcharValue.trim()} is not stale. DO NOT TRIGGER`);
    }

    let compareDate = new Date(values[0].varcharValue);

    if (config.configuration.olderThan.timeComponent === 'Days') {
      compareDate = moment().add(config.configuration.olderThan.componentValue, 'days').toDate();
    } else if (config.configuration.olderThan.timeComponent === 'Hours') {
      compareDate = moment().add(config.configuration.olderThan.componentValue, 'hours').toDate();
    } else if (config.configuration.olderThan.timeComponent === 'Minutes') {
      compareDate = moment().add(config.configuration.olderThan.componentValue, 'minutes').toDate();
    } else if (config.configuration.olderThan.timeComponent === 'Months') {
      compareDate = moment().add(config.configuration.olderThan.componentValue, 'months').toDate();
    }

    console.log(
      `Analysing age comparing isTrigger = now ${new Date().toISOString()} > ${compareDate.toISOString()}`,
    );

    return new Date() > compareDate;
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
    const ltGtThan = config.configuration.ltGtThan;
    const statFunction = config.configuration.statFunction;

    if (ltGtThan && statFunction && values.length > 0) {
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
            compared = min(doubleValues);
            break;
          case 'max':
            compared = max(doubleValues);
            break;
          case 'median':
            compared = median(doubleValues);
            break;
          case 'p90':
            const result = percentile(90, doubleValues);

            if (typeof result === 'number') {
              compared = result;
            } else if (Array.isArray(result)) {
              compared = result[0];
            } else {
              console.error(
                'Failed to evaluate percentile return type in evaluateMetricAgainstConfiguration.',
              );
              return false;
            }

            break;
          case 'sum':
            compared = sum(doubleValues);
            break;
        }
      }

      if (ltGtThan.comparator === 'gt') {
        return compared > ltGtThan.value;
      } else if (ltGtThan.comparator === 'lt') {
        return compared < ltGtThan.value;
      } else if (ltGtThan.comparator === 'lte') {
        return compared <= ltGtThan.value;
      } else if (ltGtThan.comparator === 'gte') {
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
