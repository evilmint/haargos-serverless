import { PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';

export interface Contact {
  name: string;
  email: string;
  message: string;
}

export async function postContact(contact: Contact) {
  const id = require('crypto').randomUUID();

  const putParams: PutCommandInput = {
    TableName: process.env.CONTACT_TABLE,
    Item: {
      id: id,
      ...contact,
    },
  };
  await dynamoDbClient.send(new PutCommand(putParams));
}
