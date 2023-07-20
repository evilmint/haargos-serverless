const { GetItemCommand } = require("@aws-sdk/client-dynamodb");

const authorize = async (dynamoDbClient, req, res, next) => {
    try {
      const requestData = req.body;
      const token = requestData.auth?.token;
      const userId = requestData.auth?.user_id;
  
      if (!token) {
        return res.status(400).json({ error: "Authentication token is missing." });
      }
  
      const params = {
        TableName: process.env.USERS_TABLE,
        Key: {
          "userId": { S: userId },
          "secret": { S: token }
        }
      };
  
      const response = await dynamoDbClient.send(new GetItemCommand(params));
  
      if (!response.Item) {
        return res.status(403).json({ error: "Invalid authentication token." });
      }
  
      req.user = response.Item;
  
      next(); // Proceed to the next middleware or the Lambda handler
    } catch (error) {
      console.error("Error verifying user:", error);
      return res.status(403).json({ error: "Could not verify user." });
    }
  };
  
  module.exports = authorize;