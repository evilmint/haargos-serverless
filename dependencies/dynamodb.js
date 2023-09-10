const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

let dynamoDbClientInstance;

function getDynamoDbClient() {
  if (!dynamoDbClientInstance) {
    dynamoDbClientInstance = new DynamoDBClient();
  }
  return dynamoDbClientInstance;
}

let dynamoDbClient = getDynamoDbClient();

module.exports = { dynamoDbClient };
