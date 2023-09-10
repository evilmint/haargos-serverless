import { Request } from 'express';

export interface BaseRequest extends Request {
  user: any;
  agentToken?: string;
  IN_DEV_STAGE: boolean;
}
