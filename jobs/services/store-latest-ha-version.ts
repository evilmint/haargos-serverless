import { UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import axios, { AxiosResponse } from 'axios';
import { dynamoDbClient } from '../../lib/dynamodb.js';

export async function retrieveAndStoreLatestHAVersion(): Promise<void> {
  type LatestReleaseMetadata = { tag_name: string };
  const response: AxiosResponse<LatestReleaseMetadata, any> = await axios.get(
    'https://api.github.com/repos/home-assistant/core/releases/latest',
  );

  const latestRelease = response.data.tag_name;

  const params: UpdateCommandInput = {
    TableName: process.env.CONFIGURATION_TABLE,
    Key: marshall({ id: 'latest_release' }),
    UpdateExpression: 'set version = :v',
    ExpressionAttributeValues: marshall({
      ':v': latestRelease,
    }),
    ReturnValues: 'ALL_NEW',
  };

  const command = new UpdateItemCommand(params);
  await dynamoDbClient.send(command);
}
