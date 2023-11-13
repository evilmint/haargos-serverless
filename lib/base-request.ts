import { Request } from 'express';
import { Tier } from './tier-feature-manager';

export type Subscription = {
  activated_on: string;
  expires_on: string;
  tier: Tier;
};

export type User = {
  tier: Tier;
  active: boolean;
  userId: string;
  secret: string;
  subscription: Subscription | null;
  subscriptions: Subscription[] | null;
};

export interface BaseRequest extends Request {
  user: User;
  agentToken?: Record<string, string>;
  IN_DEV_STAGE: boolean;
  query: { installation_id?: string };
}
