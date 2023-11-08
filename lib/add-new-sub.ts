import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { dynamoDbClient } from './dynamodb';

async function addNewSub(sub: string, userId: string): Promise<any> {
  const params = {
    TableName: process.env.SUB_TABLE,
    Item: marshall({
      sub: sub,
      user_id: userId,
    }),
  };

  return await dynamoDbClient.send(new PutItemCommand(params));
}

export { addNewSub };
