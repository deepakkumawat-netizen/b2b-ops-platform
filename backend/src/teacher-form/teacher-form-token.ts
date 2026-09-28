import { createHmac, timingSafeEqual } from 'crypto';

// The public teacher-details form (no login — the school fills it in) is
// reached by a per-school link. The token is an HMAC of the school id, so
// it can't be guessed for another school, needs no DB column, and keeps
// working when re-sent. Keyed off JWT_ACCESS_SECRET with a purpose prefix
// so it can never be confused with (or used as) a login token.
export function teacherFormToken(schoolId: string, secret: string): string {
  return createHmac('sha256', secret).update(`teacher-form:${schoolId}`).digest('base64url').slice(0, 32);
}

export function isValidTeacherFormToken(schoolId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(teacherFormToken(schoolId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function teacherFormUrl(appUrl: string, schoolId: string, secret: string): string {
  return `${appUrl.replace(/\/+$/, '')}/teacher-form/${schoolId}/${teacherFormToken(schoolId, secret)}`;
}
