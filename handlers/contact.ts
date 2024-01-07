import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { maskError } from '../lib/mask-error';
import { TypedRequestBody } from '../lib/typed-request-body';
import contactSchema from '../lib/yup/contact-schema';
import { Contact, postContact } from '../services/contact-service';

type ContactValidatePayload = z.infer<typeof contactSchema>;

export const PostContactHandler = async (
  req: TypedRequestBody<Contact>,
  res: Response,
) => {
  try {
    const payload: ContactValidatePayload = req.body;
    contactSchema.parse(payload);

    await postContact(payload);

    return res.status(StatusCodes.OK).json({ body: payload });
  } catch (error) {
    console.error('An error occurred:', error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: maskError(error, req.IN_DEV_STAGE) });
  }
};
