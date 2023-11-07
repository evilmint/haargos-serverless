import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import contactSchema from '../lib/yup/contact-schema';

import { dynamoDbClient } from '../lib/dynamodb';

interface Contact {
  name: string;
  email: string;
  message: string;
}

interface TypedRequestBody<T> extends Request {
  body: T;
}

type ContactValidatePayload = z.infer<typeof contactSchema>;

export const PostContactHandler = async (
  req: TypedRequestBody<Contact>,
  res: Response,
) => {
  try {
    const payload: ContactValidatePayload = req.body;
    contactSchema.parse(payload);

    const id = require('crypto').randomUUID();

    // Create the account in the USERS_TABLE
    const putParams = {
      TableName: process.env.CONTACT_TABLE,
      Item: {
        id: id,
        email: payload.email,
        message: payload.message,
        name: payload.name,
      },
    };
    await dynamoDbClient.send(new PutCommand(putParams));

    return res.status(StatusCodes.OK).json({ body: req.body });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
};
