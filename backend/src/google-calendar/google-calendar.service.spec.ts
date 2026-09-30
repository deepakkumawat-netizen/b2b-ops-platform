import { generateKeyPairSync } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { WorkshopStatus } from '@b2b-ops/shared';
import { GoogleCalendarService, googleEventId, workshopEvent } from './google-calendar.service';
import { PrismaService } from '../prisma/prisma.service';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });

const workshop = {
  id: 'w1',
  topic: 'AI Basics',
  targetGrades: '6-8',
  scheduledAt: new Date('2026-10-20T05:30:00Z'),
  status: WorkshopStatus.CONFIRMED as WorkshopStatus,
  schoolConfirmedAt: null as Date | null,
  changeRequestedAt: null as Date | null,
  changeReason: null as string | null,
  schoolId: 's1',
  school: { name: 'DPS', city: 'Jaipur', state: 'Rajasthan', ownerName: 'Mrs Rao', ownerPhone: '98765', ownerEmail: 'o@dps.in', assignedAccountManager: { name: 'Asha' } },
};

describe('workshopEvent', () => {
  it('builds a one-hour event in India time, blue while waiting for the school', () => {
    const e = workshopEvent(workshop, 'https://ops.example');
    expect(e.summary).toBe('DPS: AI Basics (grades 6-8)');
    expect(e.start).toEqual({ dateTime: '2026-10-20T05:30:00.000Z', timeZone: 'Asia/Kolkata' });
    expect(e.end.dateTime).toBe('2026-10-20T06:30:00.000Z');
    expect(e.colorId).toBe('9');
    expect(e.location).toBe('Jaipur, Rajasthan');
    expect(e.description).toContain('https://ops.example/schools/s1?tab=Workshops');
  });

  it('marks confirmed (green ✓), change requested (yellow ⚠) and completed (grey ✔)', () => {
    expect(workshopEvent({ ...workshop, schoolConfirmedAt: new Date() }, '').summary).toMatch(/^✓ /);
    const asked = workshopEvent({ ...workshop, changeRequestedAt: new Date(), changeReason: 'Exams' }, '');
    expect(asked.summary).toMatch(/^⚠ /);
    expect(asked.colorId).toBe('5');
    expect(asked.description).toContain('Exams');
    expect(workshopEvent({ ...workshop, status: WorkshopStatus.COMPLETED }, '').colorId).toBe('8');
  });
});

describe('googleEventId', () => {
  it('is stable and only uses characters Google allows', () => {
    expect(googleEventId('workshop', 'w1')).toBe(googleEventId('workshop', 'w1'));
    expect(googleEventId('workshop', 'w1')).not.toBe(googleEventId('holiday', 'w1'));
    expect(googleEventId('workshop', 'cmunqahig0011odlbcpvzajpw')).toMatch(/^[0-9a-v]{5,1024}$/);
  });
});

describe('GoogleCalendarService.syncWorkshop', () => {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  let eventExists = false;

  function makeService(row: typeof workshop | null, configured = true) {
    const env: Record<string, string | undefined> = configured
      ? { GOOGLE_CALENDAR_ID: 'ops@group.calendar.google.com', GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'bot@p.iam.gserviceaccount.com', private_key: privateKey }) }
      : {};
    const prisma = { workshop: { findUnique: jest.fn().mockResolvedValue(row) }, staff: { findMany: jest.fn().mockResolvedValue([]) } };
    return new GoogleCalendarService(prisma as unknown as PrismaService, { get: (k: string) => env[k] } as unknown as ConfigService);
  }

  beforeEach(() => {
    calls.length = 0;
    eventExists = false;
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push({ method: init?.method ?? 'GET', url: u, body: init?.body });
      if (u.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
      if (init?.method === 'PUT') return new Response('{}', { status: eventExists ? 200 : 404 });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
  });

  it('signs in, then creates the event when it does not exist yet', async () => {
    await makeService(workshop).syncWorkshop('w1');
    const assertion = new URLSearchParams(String(calls[0].body)).get('assertion')!;
    expect(JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString())).toMatchObject({ iss: 'bot@p.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/calendar' });
    expect(calls.map((c) => c.method)).toEqual(['POST', 'PUT', 'POST']);
    const created = JSON.parse(String(calls[2].body));
    expect(created.id).toBe(googleEventId('workshop', 'w1'));
    expect(calls[2].url).toContain(encodeURIComponent('ops@group.calendar.google.com'));
  });

  it('updates the event in place when it already exists', async () => {
    eventExists = true;
    await makeService(workshop).syncWorkshop('w1');
    expect(calls.map((c) => c.method)).toEqual(['POST', 'PUT']);
  });

  it('removes the event when the workshop is cancelled', async () => {
    await makeService({ ...workshop, status: WorkshopStatus.CANCELLED }).syncWorkshop('w1');
    expect(calls[1].method).toBe('DELETE');
  });

  it('does nothing, and never throws, when Google is not set up', async () => {
    await expect(makeService(workshop, false).syncWorkshop('w1')).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('keeps the error for the status panel instead of throwing', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid JWT' }), { status: 400 })) as unknown as typeof fetch;
    const service = makeService(workshop);
    await expect(service.syncWorkshop('w1')).resolves.toBeUndefined();
    expect((await service.status()).lastError).toContain('Invalid JWT');
  });
});
