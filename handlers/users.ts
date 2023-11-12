import { NextFunction, Response } from 'express';
import { pick } from 'lodash';
import { BaseRequest, Subscription } from '../lib/base-request';

const UsersMeHandler = async (req: BaseRequest, res: Response, _next: NextFunction) => {
  const allowedFields = ['userId', 'full_name', 'email', 'tier', 'subscription'];
  let filteredUser = pick(req.user, allowedFields);
  filteredUser.subscription = pick(filteredUser.subscription, [
    'activated_on',
    'expires_on',
  ]) as Subscription;

  res.json({ body: filteredUser });
};

export { UsersMeHandler };
