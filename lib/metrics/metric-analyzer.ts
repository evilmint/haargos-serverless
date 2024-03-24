import { QueryCommand, Row, TimestreamQueryClient } from '@aws-sdk/client-timestream-query';
import { _Record } from '@aws-sdk/client-timestream-write';
import { updateUserAlarmConfigurationState } from '../../services/alarm-service';
import {
  UserAlarmConfiguration,
  UserAlarmConfigurationState,
} from '../../services/static-alarm-configurations';
import { insertTrigger } from '../../services/trigger-service';
import { InstallationPing } from './metric-collector';

type MeasureValueOutput = {
  varcharValue: string | null;
  doubleValue: number | null;
};

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
    for (const config of this.userAlarmConfigurations) {
      const metricName = config.type;

      const sql = `
        SELECT
          measure_value::double as dval,
          measure_value::varchar as vval
        FROM "${this.databaseName}"."${this.tableName}" 
        WHERE
          installation_id = '${installationId}'
        AND measure_name = '${metricName}' 
        AND time between ago(3h) and now() 
        ORDER BY time DESC LIMIT ${config.configuration.datapointCount || 10}
      `;

      const command = new QueryCommand({ QueryString: sql });

      // for a given metric in the configurations, e.g. host_cpu_usage [x]
      // check x metrics (check observation # from configuration) [x]
      // apply statistic function [x]
      // check if triggered [x]
      // check if triggered state != current alarm conf state [x]
      // if they differ, update alarm configuration and insert new trigger [x]

      try {
        const result = await this.timestreamWriteClient.send(command);

        const values: MeasureValueOutput[] =
          result.Rows?.map((row: Row) => {
            const doubleValue = row.Data?.[0].ScalarValue
              ? parseFloat(row.Data?.[0].ScalarValue)
              : null;
            const varcharValue = row.Data?.[0].ScalarValue ?? null;

            return { varcharValue, doubleValue };
          }) ?? [];

        const minimumDatapoints = config.configuration.datapointCount;
        if (minimumDatapoints && values.length < minimumDatapoints) {
          continue;
        }

        if (values.length > 0) {
          const isTriggered = this.evaluateMetricAgainstConfiguration(values, config);
          const didAlarmChangeState =
            config.state == 'NO_DATA' ||
            (config.state == 'IN_ALARM' && !isTriggered) ||
            (config.state == 'OK' && isTriggered);

          if (didAlarmChangeState) {
            console.log(
              `Changing alarm for ${metricName} on installation ${installationId} for user ${config.user_id} created at ${config.created_at} based on configuration`,
            );

            const newAlarmState: UserAlarmConfigurationState = isTriggered ? 'IN_ALARM' : 'OK';

            await insertTrigger(installationId, new Date(), config.id, newAlarmState);
            await updateUserAlarmConfigurationState(
              config.user_id,
              config.created_at,
              newAlarmState,
            );
          }
        }
      } catch (error) {
        console.error('Error executing query for metric', metricName, ':', error);
      }
    }
  }

  private evaluateMetricAgainstConfiguration(
    values: MeasureValueOutput[],
    config: UserAlarmConfiguration,
  ): boolean {
    const ltGtThan = config.configuration.ltGtThan;
    const statFunction = config.configuration.statFunction;

    if (ltGtThan && statFunction && values.length > 0) {
      let compared: number;

      switch (statFunction.function) {
        case 'avg':
          compared = values.reduce((a, b) => a + (b.doubleValue ?? 0), 0) / values.length;
          break;
        case 'min':
          compared = values.reduce((a, b) => Math.min(a, b.doubleValue ?? 0), 0);
          break;
        case 'max':
          compared = values.reduce((a, b) => Math.max(a, b.doubleValue ?? 0), 0);
          break;
        case 'median':
          compared = values.reduce((a, b) => a + (b.doubleValue ?? 0), 0) / values.length;
          break;
        case 'p90':
          const ordinal = Math.ceil((config.configuration.datapointCount ?? 0) * 0.9);
          const ordered = values.sort((a, b) => (a.doubleValue ?? 0) - (b.doubleValue ?? 0));
          compared = ordered[ordinal].doubleValue ?? 0;
          break;
        case 'sum':
          compared = values.reduce((a, b) => a + (b.doubleValue ?? 0), 0);
          break;
      }

      if (ltGtThan.comparator == 'gt') {
        return compared > ltGtThan.value;
      } else if (ltGtThan.comparator == 'lt') {
        return compared < ltGtThan.value;
      } else if (ltGtThan.comparator == 'lte') {
        return compared <= ltGtThan.value;
      } else if (ltGtThan.comparator == 'gte') {
        return compared >= ltGtThan.value;
      }
    }

    return false;
  }

  async analyzePingMetricsAndCreateTriggers(installationPings: InstallationPing[]): Promise<void> {
    // Logic for analyzing pings and creating triggers
  }

  async analyzeLogMetricsAndCreateTriggers(installationId: string): Promise<void> {
    // Logic for analyzing logs and creating triggers
  }

  async analyzeAddonMetricsAndCreateTriggers(installationId: string): Promise<void> {
    // Logic for analyzing addons and creating triggers
  }

  private shouldTrigger(record: _Record): boolean {
    // Logic to determine if the record should trigger an alarm
    // This might involve comparing the metric value against thresholds in the userAlarmConfigurations
    return true; // Placeholder, implement your logic
  }

  private containsAlarmsOfType(type: string): boolean {
    return this.userAlarmConfigurations.some(config => config.type === type);
  }

  // Additional private methods as needed...
}

export default MetricAnalyzer;
