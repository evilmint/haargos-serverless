import { AlarmConfigurationTextCondition } from '../../services/static-alarm-configurations';

export class AlarmTextConditionValidator {
  private condition: AlarmConfigurationTextCondition;

  constructor(condition: AlarmConfigurationTextCondition) {
    this.condition = condition;
  }

  isValid(inputString: string): boolean {
    const { matcher, text, caseSensitive } = this.condition;
    let checkString = inputString;
    let conditionText = text;

    if (!caseSensitive) {
      checkString = inputString.toLowerCase();
      conditionText = text.toLowerCase();
    }

    switch (matcher) {
      case 'exactly':
        return checkString === conditionText;
      case 'prefix':
        return checkString.startsWith(conditionText);
      case 'suffix':
        return checkString.endsWith(conditionText);
      case 'contains':
        return checkString.includes(conditionText);
      default:
        throw new Error(`Invalid matcher type: ${matcher}`);
    }
  }
}
