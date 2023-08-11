const axios = require('axios');
const { UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = require('./dependencies/dynamodb.js');

module.exports.handler = async (event) => {
  try {
    // Scrape the latest release from GitHub
    const response = await axios.get('https://api.github.com/repos/home-assistant/core/releases/latest');
    const latestRelease = response.data.tag_name;
    
    console.log(`Latest release found: ${latestRelease}`);

    // Define the parameters to update or insert the record in DynamoDB
    const params = {
      TableName: 'configuration',
      Key: { 'id': { S: 'latest_release' } },
      UpdateExpression: 'set version = :v',
      ExpressionAttributeValues: {
        ':v': { S: latestRelease },
      },
      ReturnValues: 'ALL_NEW',
    };

    // Update or insert the record
    const command = new UpdateItemCommand(params);
    const result = await dynamoDbClient.send(command);
    console.log('Update result:', result);

    return {
      statusCode: 200,
      body: JSON.stringify(`Latest release ${latestRelease} saved successfully.`),
    };
  } catch (error) {
    console.error('An error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('An error occurred while processing your request.'),
    };
  }
};