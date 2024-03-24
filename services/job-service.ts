import {
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import moment from 'moment';
import { z } from 'zod';
import { dynamoDbClient } from '../lib/dynamodb';
import { submitJobSchema } from '../lib/zod/job-schema';

type Job = {
  installation_id: string;
  created_at: string;
  updated_at?: string;
  status_installation_id: string;
  context?: any;
  id: string;
};

export async function fetchPendingJobsByInstallationId(
  installationId: string,
): Promise<Job[] | null> {
  const params = {
    TableName: process.env.JOB_TABLE,
    IndexName: 'pending-jobs-index',
    KeyConditionExpression: '#status_installation_id = :status_val',
    ExpressionAttributeNames: {
      '#status_installation_id': 'status_installation_id',
    },
    ExpressionAttributeValues: {
      ':status_val': `pending_${installationId}`,
    },
    ScanIndexForward: false,
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));
  return response.Items ? (response.Items as Job[]) : null;
}

export async function fetchJobsByInstallationId(installationId: string): Promise<Job[] | null> {
  const params = {
    TableName: process.env.JOB_TABLE,
    KeyConditionExpression: '#installation_id = :installation_id',
    ExpressionAttributeNames: {
      '#installation_id': 'installation_id',
    },
    ExpressionAttributeValues: {
      ':installation_id': installationId,
    },
    ScanIndexForward: false,
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));

  response.Items?.forEach(item => {
    if (item.context) {
      delete item.context;
    }
  });

  return response.Items ? (response.Items as Job[]) : null;
}

export async function fetchJobById(installationId: string, jobId: string): Promise<Job | null> {
  const params = {
    TableName: process.env.JOB_TABLE,
    KeyConditionExpression: '#installation_id = :installationId AND #id = :jobId',
    IndexName: 'jobs-id-installation_id-index',
    ExpressionAttributeNames: {
      '#installation_id': 'installation_id',
      '#id': 'id',
    },
    ExpressionAttributeValues: {
      ':installationId': installationId,
      ':jobId': jobId,
    },
  };

  const response = await dynamoDbClient.send(new QueryCommand(params));
  return response.Items && response.Items.length > 0 ? (response.Items[0] as Job) : null;
}

type JobInput = z.infer<typeof submitJobSchema>;

export async function insertJob(job: JobInput, installationId: string) {
  const now = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
  const params = {
    TableName: process.env.JOB_TABLE,
    Item: {
      id: randomUUID(),
      ...job,
      installation_id: installationId,
      status_installation_id: `pending_${installationId}`,
      created_at: now,
      updated_at: now,
    },
  };

  await dynamoDbClient.send(new PutCommand(params));
}

export async function markJobAsCompleted(job: Job) {
  const newJob = {
    ...job,
    status_installation_id: `completed_${job.installation_id}`,
    created_at: moment(job.created_at).add(1, 'second').format('YYYY-MM-DD HH:mm:ss'),
    updated_at: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
  };

  const transactItems: TransactWriteCommandInput = {
    TransactItems: [
      {
        Delete: {
          TableName: process.env.JOB_TABLE,
          Key: {
            installation_id: job.installation_id,
            created_at: job.created_at,
          },
        },
      },
      {
        Put: {
          TableName: process.env.JOB_TABLE,
          Item: newJob,
        },
      },
    ],
  };

  await dynamoDbClient.send(new TransactWriteCommand(transactItems));
}
