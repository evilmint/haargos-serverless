import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import contactSchema from '../lib/yup/contact-schema';
import { Contact, postContact } from '../services/contact-service';

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

    await postContact(payload);

    return res.status(StatusCodes.OK).json({ body: req.body });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
  }
};
