export type Installation = {
  userId: string;
  id: string;
  agent_token: string;
  issues: string[];
  health_statuses: string[];
  last_agent_connection: string | null;
  name: string;
  notes: string;
  urls: {
    instance: {
      is_verified: boolean;
      url: string;
      url_type?: 'PUBLIC' | 'PRIVATE';
      verification_status: 'PENDING' | 'EMPTY' | 'SUCCESS';
      subdomain?: string;
      subdomain_value?: string;
    } | null;
  };
};
