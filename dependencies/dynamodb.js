const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const REGION = "your-aws-region";

let dynamoDbClientInstance;

function getDynamoDbClient() {
  if (!dynamoDbClientInstance) {
    dynamoDbClientInstance = new DynamoDBClient();
  }
  return dynamoDbClientInstance;
}

module.exports = getDynamoDbClient();