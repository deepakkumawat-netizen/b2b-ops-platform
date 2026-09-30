import { createHmac, timingSafeEqual } from 'crypto';

// The public "confirm or change this date" page a school reaches from its
// workshop emails. Same scheme as the school details link (see
// teacher-form-token.ts): an HMAC of the workshop id with its own purpose
// prefix, so it only opens that one workshop and needs no DB column.
export function workshopResponseToken(workshopId: string, secret: string): string {
  return createHmac('sha256', secret).update(`workshop-response:${workshopId}`).digest('base64url').slice(0, 32);
}

export function isValidWorkshopResponseToken(workshopId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(workshopResponseToken(workshopId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function workshopResponseUrl(appUrl: string, workshopId: string, secret: string): string {
  return `${appUrl.replace(/\/+$/, '')}/workshop/${workshopId}/${workshopResponseToken(workshopId, secret)}`;
}
