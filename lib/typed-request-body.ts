import { Request } from 'express';
import { User } from './base-request';

export interface TypedRequestBody<T> extends Request {
  body: T;
  user: User;
}
