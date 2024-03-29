import { GetItemCommand } from '@aws-sdk/client-dynamodb';
const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const nodemailer = require('nodemailer');

const dynamoDBClient = new DynamoDBClient({ region: 'your-region' });

const alarmTriggerTableName = process.env.ALARM_TRIGGER_TABLE;
const usersTableName = process.env.USERS_TABLE;

export const handler = async (_event: any) => {
  const scanParams = {
    TableName: alarmTriggerTableName,
    FilterExpression: 'processed = :processedValue',
    ExpressionAttributeValues: {
      ':processedValue': { N: '0' },
    },
  };

  try {
    const scanResult = await dynamoDBClient.send(new ScanCommand(scanParams));

    const transporter = nodemailer.createTransport({
      host: 'mail.haargos.com',
      port: 587,
      secure: false,
      auth: {
        user: 'alerts@haargos.com',
        pass: 'PRONAi,72,=',
      },
    });

    for (const item of scanResult.Items) {
      const userId = item.user_id.S;

      const userParams = {
        TableName: usersTableName,
        Key: { userId: { S: userId } },
      };

      const userData = await dynamoDBClient.send(new GetItemCommand(userParams));

      if (userData.Item) {
        const userEmail = userData.Item.email.S;

        const mailOptions = {
          from: '"Haargos Alerts" <alerts@haargos.com>',
          to: userEmail,
          subject: 'abc',
          text: 'def',
        };

        // Send mail with defined transport object
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);

        const updateParams = {
          TableName: alarmTriggerTableName,
          Key: {
            user_id: { S: userId },
            trigger_id: { S: item.trigger_id.S },
          },
          UpdateExpression: 'set processed = :processedValue',
          ExpressionAttributeValues: {
            ':processedValue': { N: '1' },
          },
        };

        await dynamoDBClient.send(new UpdateItemCommand(updateParams));
        console.log('Trigger marked as processed for user', userId);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
