import { PutCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb.js';
import { Tier, TierResolver } from '../lib/tier-resolver.js';

async function getObservations(
  tier: Tier,
  userId: string,
  installationId: string,
  order: 'ascending' | 'descending',
  limit: number,
) {
  let params: QueryCommandInput = {
    TableName: String(process.env.OBSERVATION_TABLE),
    KeyConditionExpression: '#userId = :userId AND #installation_id = :installationId',
    IndexName: 'userId-installation_id-index',
    ExpressionAttributeNames: {
      '#userId': 'userId',
      '#installation_id': 'installation_id',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':installationId': installationId,
    },
    ScanIndexForward: order == 'descending' ? false : true,
  };

  if (typeof limit !== 'undefined' && limit != null) {
    params.Limit = limit;
  }

  let observations = await dynamoDbClient.send(new QueryCommand(params));

  if (!TierResolver.isAdvancedAnalyticsEnabled(tier)) {
    observations.Items?.forEach(observation => {
      observation.zigbee.devices.forEach(device => {
        delete device.lqi;
        delete device.battery;
      });
    });
  }

  return observations;
}

async function putObservation(item: any) {
  const params = {
    TableName: process.env.OBSERVATION_TABLE,
    Item: item,
  };

  await dynamoDbClient.send(new PutCommand(params));
}

export { getObservations, putObservation };
