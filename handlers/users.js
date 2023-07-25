const { unmarshall } = require("@aws-sdk/util-dynamodb");

const dynamoDbClient = require("../dependencies/dynamodb.js");
const _ = require("lodash");

const UsersMeHandler = async (req, res, next) => {
  const allowedFields = ["userId", "full_name", "email"];
  const filteredUser = unmarshall(_.pick(req.user, allowedFields));

  res.json({ body: filteredUser });
};

module.exports = { UsersMeHandler };
