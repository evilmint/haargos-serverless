import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { PutCommandInput } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { dynamoDbClient } from './dynamodb';

async function addNewSub(sub: string, userId: string): Promise<any> {
  const params: PutCommandInput = {
    TableName: process.env.SUB_TABLE,
    Item: marshall({
      sub: sub,
      user_id: userId,
      email_verified: false,
    }),
  };

  return await dynamoDbClient.send(new PutItemCommand(params));
}

export { addNewSub };
