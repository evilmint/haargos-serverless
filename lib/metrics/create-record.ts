export default function createRecord(
  installationId: string,
  measureName: string,
  measureValue: string,
  time: string,
  dimensions: { Name: string; Value: string }[] = [],
) {
  const baseDimensions = [{ Name: 'installation_id', Value: installationId }];

  return {
    Dimensions: baseDimensions.concat(dimensions),
    MeasureName: measureName,
    MeasureValue: measureValue,
    MeasureValueType: 'DOUBLE',
    Time: time,
    TimeUnit: 'MILLISECONDS',
  };
}
