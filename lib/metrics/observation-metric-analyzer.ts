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

    // Existing checks for high CPU usage and low LQI in Zigbee devices
    this.checkHighCPUUsage(observationData, records);
    this.checkLowZigbeeLQI(observationData, records);

    // New analyses
    this.checkLowMemory(observationData, records);
    this.checkHighDiskUsage(observationData, records);
    this.checkNewHAVersion(observationData, records);
    this.checkPingUnavailability(observationData, records);

    // Store all generated records
    if (records.length > 0) {
      await this.metricStore.storeMetrics(records);
    }
  }

  private checkHighCPUUsage(
    observationData: z.infer<typeof observationSchema>,
    records: any[],
  ): void {
    const isHighCPUUsage = (observationData.environment?.cpu?.load ?? 0) > 1;
    if (isHighCPUUsage) {
      records.push(this.createCpuUsageRecord(observationData));
    }
  }

  private checkLowZigbeeLQI(
    observationData: z.infer<typeof observationSchema>,
    records: any[],
  ): void {
    observationData.zigbee?.devices.forEach(device => {
      const isLowLQI = device.lqi < 20;
      if (isLowLQI) {
        records.push(this.createZigbeeLqiRecord(observationData, device));
      }
    });
  }

  private checkLowMemory(
    observationData: z.infer<typeof observationSchema>,
    records: any[],
  ): void {
    const isLowMemory =
      (observationData.environment?.memory?.used ?? 0) /
        (observationData.environment?.memory?.total ?? 1) >
      0.8;
    if (isLowMemory) {
      records.push(this.createLowMemoryRecord(observationData));
    }
  }

  private checkHighDiskUsage(
    observationData: z.infer<typeof observationSchema>,
    records: any[],
  ): void {
    observationData.environment?.storage?.forEach(storage => {
      const usagePercentage = parseInt(storage.use_percentage.replace('%', ''));
      if (usagePercentage > 80) {
        records.push(this.createHighDiskUsageRecord(observationData, storage));
      }
    });
  }

  private checkNewHAVersion(
    observationData: z.infer<typeof observationSchema>,
    records: any[],
  ): void {
    // Implement logic to check for new HA version and generate a record if needed
  }

  private checkPingUnavailability(
    observationData: z.infer<typeof observationSchema>,
    records: any[],
  ): void {
    // Implement logic to check for ping unavailability and generate a record if needed
  }

  private createCpuUsageRecord(observationData: z.infer<typeof observationSchema>): any {
    return createRecord(
      observationData.installation_id,
      'cpu_usage_below_threshold',
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
      'zigbee_lqi_below_threshold',
      device.lqi.toString(),
      new Date().getTime().toString(),
      [{ Name: 'ieee', Value: device.ieee }],
    );
  }

  private createLowMemoryRecord(observationData: z.infer<typeof observationSchema>): any {
    return createRecord(
      observationData.installation_id,
      'memory_below_threshold',
      (observationData.environment.memory?.free ?? 0).toString(),
      new Date().getTime().toString(),
    );
  }

  private createHighDiskUsageRecord(
    observationData: z.infer<typeof observationSchema>,
    storage: any,
  ): any {
    return createRecord(
      observationData.installation_id,
      'high_disk_usage',
      (observationData.environment.memory?.free ?? 0).toString(),
      new Date().getTime().toString(),
    );
  }
}
