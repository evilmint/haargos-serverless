import moment from 'moment';

export function formattedHoursAndMinutes(date1: string, date2: string): string {
  let durationInSeconds = moment(date1).diff(moment(date2)) / 1000;

  const durationInDays = Math.floor(durationInSeconds / 86400);
  durationInSeconds -= durationInDays * 86400;

  const durationInHours = Math.floor(durationInSeconds / 3600);
  durationInSeconds -= durationInHours * 3600;

  return `${durationInDays.toFixed(0)} days, ${durationInHours.toFixed(0)} hours.`;
}
