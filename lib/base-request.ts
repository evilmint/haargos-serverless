import { Request } from 'express';

export interface BaseRequest extends Request {
  user: any;
  agentToken?: Record<string, string>;
  IN_DEV_STAGE: boolean;
  query: { installation_id?: string }
}
