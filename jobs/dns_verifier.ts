import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../lib/dynamodb';
import dns from 'dns';
import {
  DeleteCommandInput,
  ScanCommandInput,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';

export const handler = async (_event: any) => {
  const attemptsAllowed = 20; // TODO: Move to ENV

  try {
    const scanParams: ScanCommandInput = {
      TableName: process.env.DNS_VERIFICATION_TABLE,
    };

    const scanResponse = await dynamoDbClient.send(new ScanCommand(scanParams));
    const items = scanResponse.Items || [];

    for (const item of items) {
      const subdomain = item.subdomain.S ?? '';
      const verificationValue = item.value.S ?? '';
      let attempts = parseInt(item.attempts.N || '0', 10);

      // Perform the DNS query here to check if the TXT record matches the verificationValue
      const entries = await performDnsTxtQuery(subdomain);
      const isVerified = entries.includes(verificationValue);

      if (!isVerified) {
        // Increment the attempts count when verification fails
        attempts++;

        // Update the attempts count in the DNS verifications table
        const updateAttemptsParams: UpdateCommandInput = {
          TableName: process.env.DNS_VERIFICATION_TABLE,
          Key: {
            installation_id: item.installation_id.S,
            type: item.type.S,
          },
          UpdateExpression: 'SET #attempts = :attempts',
          ExpressionAttributeNames: {
            '#attempts': 'attempts',
          },
          ExpressionAttributeValues: {
            ':attempts': attempts,
          },
        };

        try {
          await dynamoDbClient.send(new UpdateCommand(updateAttemptsParams));
        } catch {
          return {
            statusCode: 400,
            body: JSON.stringify(
              'Failed updating attempts ' + JSON.stringify(updateAttemptsParams),
            ),
          };
        }
      }

      const updateParams: UpdateCommandInput = {
        TableName: process.env.INSTALLATION_TABLE, // Replace with the installation table name
        Key: {
          userId: item.user_id.S,
          id: item.installation_id.S,
        },
        UpdateExpression:
          'SET #urls.#instance.is_verified = :isVerified, #urls.#instance.verification_status = :status',
        ExpressionAttributeNames: {
          '#urls': 'urls',
          '#instance': 'instance',
        },
        ExpressionAttributeValues: {
          ':isVerified': isVerified,
          ':status': isVerified
            ? 'SUCCESS'
            : attempts >= attemptsAllowed
            ? 'FAILED'
            : 'PENDING',
        },
      };

      try {
        await dynamoDbClient.send(new UpdateCommand(updateParams));
      } catch (error) {
        return {
          statusCode: 400,
          body: JSON.stringify(
            'Failed updating installation ' +
              JSON.stringify(updateParams) +
              'error: ' +
              error,
          ),
        };
      }

      if (isVerified || attempts >= attemptsAllowed) {
        const deleteParams: DeleteCommandInput = {
          TableName: process.env.DNS_VERIFICATION_TABLE,
          Key: {
            type: item.type,
            installation_id: item.installation_id,
          },
        };
        // Delete the DNS verification record if verified or max attempts reached
        try {
          await dynamoDbClient.send(new DeleteItemCommand(deleteParams));
        } catch (error) {
          return {
            statusCode: 400,
            body: JSON.stringify(
              'Failed deleting record' +
                JSON.stringify(deleteParams) +
                ' error: ' +
                error,
            ),
          };
        }
      }

      return {
        statusCode: 200,
        body: `No Entries isVerified: ${isVerified} entries: ${entries}`,
      };
    }

    return {
      statusCode: 200,
      body: 'No Entries isVerified: ',
    };
  } catch (error) {
    console.error('An error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('An error occurred while processing your request.'),
    };
  }
};

async function performDnsTxtQuery(subdomain: string): Promise<string[]> {
  const entries: string[] = await new Promise(resolve => {
    dns.resolveTxt(subdomain, (a, b) => {
      if (b) {
        resolve(b.map(a => a[0]));
      } else {
        resolve([]);
      }
    });
  });

  return entries;
}
