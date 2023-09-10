import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

let dynamoDbClientInstance: DynamoDBClient;

function getDynamoDbClient(): DynamoDBClient {
  if (!dynamoDbClientInstance) {
    dynamoDbClientInstance = new DynamoDBClient();
  }
  return dynamoDbClientInstance;
}

let dynamoDbClient = getDynamoDbClient();

export { dynamoDbClient };
