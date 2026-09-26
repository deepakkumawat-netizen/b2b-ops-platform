// The business runs on Indian time, but the server (Render) runs on UTC — so
// anything that means "today", "tomorrow", "this year" or prints a time to a
// school must go through here instead of Date's local-time methods
// (setHours, getFullYear, toLocaleString), which silently use the server's
// timezone.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Milliseconds `timeZone` is ahead of UTC at `date` (e.g. +19_800_000 for IST). */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant midnight begins, in `timeZone`, on the day containing `date`
 * shifted by `addDays` (0 = today, 1 = tomorrow). */
export function startOfDayInZone(date: Date, addDays = 0, timeZone = APP_TIMEZONE): Date {
  const p = zonedParts(date, timeZone);
  const midnightAsUtc = Date.UTC(p.year, p.month - 1, p.day + addDays);
  return new Date(midnightAsUtc - zoneOffsetMs(new Date(midnightAsUtc), timeZone));
}

export function yearInZone(date: Date, timeZone = APP_TIMEZONE): number {
  return zonedParts(date, timeZone).year;
}

/** Human-readable date + time in the business timezone, for emails. */
export function formatInZone(date: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
