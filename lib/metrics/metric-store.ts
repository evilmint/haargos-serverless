import {
  TimestreamWriteClient,
  WriteRecordsCommand,
} from '@aws-sdk/client-timestream-write';

export default class MetricStore {
  private timestreamWriteClient: TimestreamWriteClient;
  private databaseName: string;
  private tableName: string;

  constructor(region: string, databaseName: string, tableName: string) {
    this.timestreamWriteClient = new TimestreamWriteClient({ region: region });
    this.databaseName = databaseName;
    this.tableName = tableName;
  }

  async storeMetrics(records: any[]): Promise<void> {
    if (records.length === 0) {
      console.log('No metrics to store.');
      return;
    }

    const writeRecordsParams = {
      DatabaseName: this.databaseName,
      TableName: this.tableName,
      Records: records,
    };

    try {
      await this.timestreamWriteClient.send(new WriteRecordsCommand(writeRecordsParams));
      console.log('Metrics written to Timestream successfully.');
    } catch (error) {
      console.error('Failed to write metrics to Timestream:', error);
      throw error;
    }
  }
}
