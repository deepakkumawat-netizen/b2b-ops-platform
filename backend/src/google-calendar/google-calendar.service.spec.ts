import { generateKeyPairSync } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { StaffRole, WorkshopStatus } from '@b2b-ops/shared';
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

describe('GoogleCalendarService.syncAccess', () => {
  const env: Record<string, string> = {
    GOOGLE_CALENDAR_ID: 'main@group.calendar.google.com',
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'bot@p.iam.gserviceaccount.com', private_key: privateKey }),
  };
  const staff = [
    { id: 'a', name: 'Admin', email: 'admin@x.com', role: 'SUPER_ADMIN', isActive: true, googleCalendarId: null },
    { id: 'm', name: 'Manager', email: 'am@x.com', role: 'ACCOUNT_MANAGER', isActive: true, googleCalendarId: null },
    { id: 'g', name: 'Gone', email: 'gone@x.com', role: 'SALES', isActive: false, googleCalendarId: null },
    { id: 'o', name: 'Old AM now Sales', email: 'moved@x.com', role: 'SALES', isActive: true, googleCalendarId: 'old-am-cal' },
  ];

  it('shares by role: main calendar for non-managers, own calendar for managers, none for the deactivated', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      const u = decodeURIComponent(String(url));
      const method = init?.method ?? 'GET';
      if (u.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
      calls.push(`${method} ${u.replace('https://www.googleapis.com/calendar/v3', '')}${init?.body && method !== 'GET' ? ` ${init.body}` : ''}`);
      if (method === 'GET') {
        // gone@ still has the view access we gave earlier; the owner must never be touched.
        return new Response(JSON.stringify({ items: [{ role: 'reader', scope: { type: 'user', value: 'gone@x.com' } }, { role: 'owner', scope: { type: 'user', value: 'boss@x.com' } }] }));
      }
      if (method === 'POST' && u.endsWith('/calendars')) return new Response(JSON.stringify({ id: 'am-cal' }));
      return new Response('{}');
    }) as unknown as typeof fetch;
    const prisma = { staff: { findMany: jest.fn().mockResolvedValue(staff), update: jest.fn() } };
    const service = new GoogleCalendarService(prisma as unknown as PrismaService, { get: (k: string) => env[k] } as unknown as ConfigService);

    const rows = await service.syncAccess();

    expect(rows.map((r) => [r.email, r.access])).toEqual([
      ['admin@x.com', 'all schools'],
      ['am@x.com', 'own schools'],
      ['gone@x.com', 'none'],
      ['moved@x.com', 'all schools'],
    ]);
    const main = '/calendars/main@group.calendar.google.com/acl';
    expect(calls).toContain(`POST ${main}?sendNotifications=true {"role":"reader","scope":{"type":"user","value":"admin@x.com"}}`);
    expect(calls).toContain(`DELETE ${main}/user:gone@x.com`);
    expect(calls.some((c) => c.includes('boss@x.com') && !c.startsWith('GET'))).toBe(false);
    // The manager gets a new calendar of their own, shared with them, not the main one.
    expect(calls.some((c) => c.startsWith(`POST ${main}`) && c.includes('am@x.com'))).toBe(false);
    expect(calls).toContain('POST /calendars/am-cal/acl?sendNotifications=true {"role":"reader","scope":{"type":"user","value":"am@x.com"}}');
    expect(prisma.staff.update).toHaveBeenCalledWith({ where: { id: 'm' }, data: { googleCalendarId: 'am-cal' } });
    // Someone who stopped being a manager loses their old manager calendar.
    expect(calls).toContain('DELETE /calendars/old-am-cal');
    expect(prisma.staff.update).toHaveBeenCalledWith({ where: { id: 'o' }, data: { googleCalendarId: null } });
  });
});

describe('GoogleCalendarService — quick changes to the same event', () => {
  it('runs them one after another, so the latest change wins', async () => {
    const env: Record<string, string> = {
      GOOGLE_CALENDAR_ID: 'main@group.calendar.google.com',
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'bot@p.iam.gserviceaccount.com', private_key: privateKey }),
    };
    const order: string[] = [];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
      // Google is slow to answer the first update.
      if (init?.method === 'PUT') await new Promise((r) => setTimeout(r, 50));
      order.push(init?.method ?? 'GET');
      return new Response('{}', { status: init?.method === 'PUT' ? 404 : 200 });
    }) as unknown as typeof fetch;
    // Scheduled when the first sync reads it, cancelled by the time the second does.
    const findUnique = jest.fn().mockResolvedValueOnce(workshop).mockResolvedValueOnce({ ...workshop, status: WorkshopStatus.CANCELLED });
    const prisma = { workshop: { findUnique }, staff: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new GoogleCalendarService(prisma as unknown as PrismaService, { get: (k: string) => env[k] } as unknown as ConfigService);

    await Promise.all([service.syncWorkshop('w1'), service.syncWorkshop('w1')]);

    // Create (PUT → 404, then POST) fully finishes before the delete, so the event ends up removed.
    expect(order).toEqual(['PUT', 'POST', 'DELETE']);
  });
});

describe('GoogleCalendarService.status — "Open my Google Calendar" link', () => {
  const env: Record<string, string> = {
    GOOGLE_CALENDAR_ID: 'main@group.calendar.google.com',
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'bot@p.iam.gserviceaccount.com', private_key: privateKey }),
    GOOGLE_CALENDAR_OWNER_EMAIL: 'owner@gmail.com',
  };
  const serviceFor = (me: { email: string; googleCalendarId: string | null }) =>
    new GoogleCalendarService(
      { staff: { findUnique: jest.fn().mockResolvedValue(me), findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService,
      { get: (k: string) => env[k] } as unknown as ConfigService,
    );

  it('opens the main calendar as the owner account for a Super Admin', async () => {
    const s = await serviceFor({ email: 'admin@b2bops.dev', googleCalendarId: null }).status({ sub: 'a', role: StaffRole.SUPER_ADMIN });
    expect(s.openUrl).toBe('https://calendar.google.com/calendar/r?authuser=owner%40gmail.com');
    expect(s.addUrl).toBe('https://calendar.google.com/calendar/r?cid=main%40group.calendar.google.com&authuser=owner%40gmail.com');
  });

  it("opens an account manager's own calendar as themselves", async () => {
    const s = await serviceFor({ email: 'am@codevidhya.com', googleCalendarId: 'am-cal' }).status({ sub: 'm', role: StaffRole.ACCOUNT_MANAGER });
    expect(s.openUrl).toBe('https://calendar.google.com/calendar/r?authuser=am%40codevidhya.com');
    expect(s.addUrl).toBe('https://calendar.google.com/calendar/r?cid=am-cal&authuser=am%40codevidhya.com');
    expect(s.embedUrl).toBe('https://calendar.google.com/calendar/embed?src=am-cal&ctz=Asia%2FKolkata&mode=MONTH&showPrint=0&authuser=am%40codevidhya.com');
  });
});
