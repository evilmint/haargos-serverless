import { Options } from 'nodemailer/lib/mailer';
import { mailTransport } from '../../lib/mail-transporter';
import {
  fetchUserAlarmConfiguration,
  getUnprocessedAlarmTriggers,
  markAlarmTriggerAsProcessed,
} from '../../services/alarm-service';
import { getUserById } from '../../services/user-service';
import { AlarmMailContentCreator } from './alarm-mail-content-creator';

export const handler = async (_event: any) => {
  try {
    const unprocessedAlarmTriggers = await getUnprocessedAlarmTriggers();

    if (unprocessedAlarmTriggers.length === 0) {
      return;
    }

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
        const mailContent = new AlarmMailContentCreator(alarmConfiguration, alarmTrigger).build();

        const mailOptions: Options = {
          from: process.env.MAIL_CONFIG_ALARM_TRIGGER_FROM,
          to: user.email,
          subject: mailContent.subject,
          text: mailContent.body,
        };

        await mailTransport.sendMail(mailOptions);

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
