import { NextFunction, Response } from 'express';
import { pick } from 'lodash';
import { BaseRequest } from '../lib/base-request';

const UsersMeHandler = async (req: BaseRequest, res: Response, _next: NextFunction) => {
  const allowedFields = ['userId', 'full_name', 'email', 'tier'];
  const filteredUser = pick(req.user, allowedFields);

  res.json({ body: filteredUser });
};

export { UsersMeHandler };
