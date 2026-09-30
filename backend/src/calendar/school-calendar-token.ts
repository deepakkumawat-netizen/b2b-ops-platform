import { createHmac, timingSafeEqual } from 'crypto';

// The school's own calendar page (its workshops, plus the holidays it marks).
// Same scheme as the school details link (see teacher-form-token.ts): an
// HMAC of the school id with its own purpose prefix, so it needs no DB
// column and keeps working when re-sent.
export function schoolCalendarToken(schoolId: string, secret: string): string {
  return createHmac('sha256', secret).update(`school-calendar:${schoolId}`).digest('base64url').slice(0, 32);
}

export function isValidSchoolCalendarToken(schoolId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(schoolCalendarToken(schoolId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function schoolCalendarUrl(appUrl: string, schoolId: string, secret: string): string {
  return `${appUrl.replace(/\/+$/, '')}/calendar/${schoolId}/${schoolCalendarToken(schoolId, secret)}`;
}
