import moment from 'moment';
import nodemailer from 'nodemailer';
import { Options } from 'nodemailer/lib/mailer';
import {
  fetchUserAlarmConfiguration,
  getUnprocessedAlarmTriggers,
  markAlarmTriggerAsProcessed,
} from '../services/alarm-service';
import { getUserById } from '../services/user-service';

export const handler = async (_event: any) => {
  try {
    const unprocessedAlarmTriggers = await getUnprocessedAlarmTriggers();

    if (unprocessedAlarmTriggers.length === 0) {
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_OUTGOING_HOST,
      port: parseInt(process.env.MAIL_OUTGOING_PORT ?? '587'),
      secure: false,
      auth: {
        user: process.env.MAIL_OUTGOING_USER,
        pass: process.env.MAIL_OUTGOING_PASSWORD,
      },
    });

    // TODO: Fetch all user ids here in case they appear more than once

    for (const alarmTrigger of unprocessedAlarmTriggers) {
      const user = await getUserById(alarmTrigger.user_id);
      const alarmConfiguration = await fetchUserAlarmConfiguration(
        alarmTrigger.alarm_configuration,
      );

      if (!alarmConfiguration) {
        console.error(`Could not find alarm config [id=${alarmTrigger.alarm_configuration}]`);
        continue;
      }

      if (user) {
        const userEmail = user.email;

        const formattedTriggeredAtDate = moment(alarmTrigger.triggered_at)
          .utc()
          .format('ddd DD MMMM, YYYY HH:mm:ss [UTC]')
          .toString();

        const subject = `Alarm "${alarmConfiguration.name}" changed to ${alarmTrigger.state}`;
        const text = `Alarm "${alarmConfiguration.name}" went into ${alarmTrigger.state} at ${formattedTriggeredAtDate}.`;

        const mailOptions: Options = {
          from: process.env.MAIL_CONFIG_ALARM_TRIGGER_FROM,
          to: userEmail,
          subject: subject,
          text: text,
        };

        await transporter.sendMail(mailOptions);

        // TODO: Batch update instead
        await markAlarmTriggerAsProcessed(alarmTrigger);
      } else {
        console.error(`Could not find user by [user_id=${alarmTrigger.user_id}]`);
      }
    }
  } catch (error) {
    console.error('Errors:', error);
  }
};
