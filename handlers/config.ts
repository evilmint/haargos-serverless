import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TypedRequestBody } from '../lib/typed-request-body';
import { Contact } from '../services/contact-service';

export const GetAgentConfigHandler = async (_req: TypedRequestBody<Contact>, res: Response) => {
  const config = {};
  config['cycle_interval'] = 15 * 60;

  return res.status(StatusCodes.OK).json({ body: config });
};
