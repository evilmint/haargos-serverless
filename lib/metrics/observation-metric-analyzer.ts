import { z } from 'zod';
import { observationSchema } from '../zod/observation-schema';
import createRecord from './create-record';
import MetricStore from './metric-store';

export default class ObservationMetricAnalyzer {
  private metricStore: MetricStore;

  constructor(metricStore: MetricStore) {
    this.metricStore = metricStore;
  }

  async analyzeAndStoreMetrics(
    observationData: z.infer<typeof observationSchema>,
  ): Promise<void> {
    const records: any[] = [];

    // Check for high CPU usage
    const isHighCPUUsage = (observationData.environment?.cpu?.load ?? 0) > 1;
    if (isHighCPUUsage) {
      records.push(this.createCpuUsageRecord(observationData));
    }

    // Check for low LQI in Zigbee devices
    observationData.zigbee?.devices.forEach(device => {
      const isLowLQI = device.lqi < 20; // TODO: Unify logic across files. Maybe this should be part of the observationSchema

      if (isLowLQI) {
        records.push(this.createZigbeeLqiRecord(observationData, device));
      }
    });

    // Low memory

    // high disk usage

    // const volumeUsagePercentage =
    //   observationData.environment.storage?.reduce((highest, current) => {
    //     const cur = parseInt(current.use_percentage.slice(0, -1));
    //     return cur > highest ? cur : highest;
    //   }, {}) ?? 0;

    // if (volumeUsagePercentage > 80) {
    //     records.push(this.createHighVolumeUsageRecord(observationData, device));
    // }

    // New ha version
    // ping unavailability

    await this.metricStore.storeMetrics(records);
  }

  private createCpuUsageRecord(observationData: z.infer<typeof observationSchema>): any {
    return createRecord(
      observationData.installation_id,
      'cpu_usage',
      (observationData.environment.cpu?.load ?? 0).toString(),
      new Date().getTime().toString(),
    );
  }

  private createZigbeeLqiRecord(
    observationData: z.infer<typeof observationSchema>,
    device: any,
  ): any {
    return createRecord(
      observationData.installation_id,
      'zigbee_lqi',
      device.lqi.toString(),
      new Date().getTime().toString(),
      [{ Name: 'ieee', Value: device.ieee }],
    );
  }
}
