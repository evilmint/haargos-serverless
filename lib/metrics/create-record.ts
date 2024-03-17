import { Dimension, MeasureValueType, _Record } from '@aws-sdk/client-timestream-write';

export default function createRecord(
  installationId: string,
  measureName: string,
  measureValue: string,
  time: string,
  recordType: MeasureValueType,
  dimensions: Dimension[] = [],
): _Record {
  const baseDimensions: Dimension[] = [{ Name: 'installation_id', Value: installationId }];

  return {
    Dimensions: baseDimensions.concat(dimensions),
    MeasureName: measureName,
    MeasureValue: measureValue,
    MeasureValueType: recordType,
    Time: time,
    TimeUnit: 'MILLISECONDS',
  };
}
