import moment from 'moment';
import { formattedHoursAndMinutes } from '../../lib/formatted-hours-and-minutes';
import { AlarmConfigurationTrigger } from '../../services/alarm-service';
import { UserAlarmConfigurationOutput } from '../../services/static-alarm-configurations';

export type MailContent = { subject: string; body: string };

export class AlarmMailContentCreator {
  private alarmConfiguration: UserAlarmConfigurationOutput;
  private alarmTrigger: AlarmConfigurationTrigger;

  constructor(
    alarmConfiguration: UserAlarmConfigurationOutput,
    alarmTrigger: AlarmConfigurationTrigger,
  ) {
    this.alarmConfiguration = alarmConfiguration;
    this.alarmTrigger = alarmTrigger;
  }

  build(): MailContent {
    const alarmHasGoneOff =
      this.alarmTrigger.state.state === 'OK' && this.alarmTrigger.old_state.state === 'IN_ALARM';
    const alarmCategory = this.alarmConfiguration.category;
    const alarmCategoryFormatted =
      alarmCategory.toLocaleUpperCase()[0] + alarmCategory.toLocaleLowerCase().substring(1);
    const alarmTextPrefix = `${alarmCategoryFormatted} alarm "${this.alarmConfiguration.name}"`;
    let subject: string;
    let text: string;

    const formattedTriggeredAtDate = moment(this.alarmTrigger.triggered_at)
      .utc()
      .format('ddd DD MMMM, YYYY HH:mm:ss [UTC]')
      .toString();

    if (alarmHasGoneOff) {
      subject = `Alarm "${this.alarmConfiguration.name}" has gone off`;
      text = `${alarmTextPrefix} has gone off at ${formattedTriggeredAtDate}.`;

      const formattedTimeElapsed = formattedHoursAndMinutes(
        this.alarmTrigger.state.date,
        this.alarmTrigger.old_state.date,
      );

      text += ` The alarm was active for ${formattedTimeElapsed}`;
    } else {
      subject = `Alarm "${this.alarmConfiguration.name}" changed to ${this.alarmTrigger.state.state}`;
      text = `${alarmTextPrefix} alarm "${this.alarmConfiguration.name}" went into ${this.alarmTrigger.state.state} state at ${formattedTriggeredAtDate}.`;
    }

    return {
      body: text,
      subject: subject,
    };
  }
}
