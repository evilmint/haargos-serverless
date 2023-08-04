const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

let dynamoDbClientInstance;

function getDynamoDbClient() {
  if (!dynamoDbClientInstance) {
    dynamoDbClientInstance = new DynamoDBClient();
  }
  return dynamoDbClientInstance;
}

module.exports = getDynamoDbClient();
