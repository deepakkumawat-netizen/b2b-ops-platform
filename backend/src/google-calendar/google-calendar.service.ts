import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createSign } from 'crypto';
import { readFileSync } from 'fs';
import { StaffRole, WorkshopStatus } from '@b2b-ops/shared';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { APP_TIMEZONE, isoDateInZone } from '../common/time';

const API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Workshops have no end time in the tool; they show as this long in Google Calendar. */
export const WORKSHOP_EVENT_MINUTES = 60;
/** The daily safety-net sync covers workshops and holidays this far ahead. */
const SYNC_AHEAD_DAYS = 365;

// Google Calendar's own colour ids.
const COLOR = { blue: '9', green: '10', yellow: '5', grey: '8' } as const;

type ServiceAccount = { client_email: string; private_key: string };

/** One row per staff member for the admin's "who can see it" list. */
export type AccessRow = { name: string; email: string; role: StaffRole; access: 'all schools' | 'own schools' | 'none'; error: string | null };

const calendarUrl = (calendarId: string) => `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId)}`;

/** Google event ids allow only 0-9 and a-v; a hash of our own id is stable, so an event never needs its id stored. */
export function googleEventId(kind: 'workshop' | 'holiday', key: string): string {
  return createHash('sha256').update(`${kind}:${key}`).digest('hex').slice(0, 40);
}

type WorkshopForEvent = {
  id: string;
  topic: string;
  targetGrades: string | null;
  scheduledAt: Date;
  status: WorkshopStatus;
  schoolConfirmedAt: Date | null;
  changeRequestedAt: Date | null;
  changeReason: string | null;
  schoolId: string;
  school: {
    name: string;
    city: string | null;
    state: string | null;
    ownerName: string | null;
    ownerPhone: string | null;
    ownerEmail: string | null;
    assignedAccountManager: { name: string } | null;
  };
};

/** The Google Calendar event for a workshop; its colour and ✓/⚠ mark show where it stands. */
export function workshopEvent(w: WorkshopForEvent, appUrl: string) {
  const [mark, colorId, state] =
    w.status === WorkshopStatus.COMPLETED
      ? ['✔ ', COLOR.grey, 'Completed']
      : w.changeRequestedAt
        ? ['⚠ ', COLOR.yellow, `School asked to change the date${w.changeReason ? ` (${w.changeReason})` : ''}`]
        : w.schoolConfirmedAt
          ? ['✓ ', COLOR.green, 'Confirmed by the school']
          : ['', COLOR.blue, 'Waiting for the school to confirm'];
  const end = new Date(w.scheduledAt.getTime() + WORKSHOP_EVENT_MINUTES * 60_000);
  const s = w.school;
  const description = [
    `Status: ${state}`,
    w.targetGrades ? `Grades: ${w.targetGrades}` : null,
    `School contact: ${[s.ownerName, s.ownerPhone, s.ownerEmail].filter(Boolean).join(', ') || 'not on file'}`,
    `Account manager: ${s.assignedAccountManager?.name ?? 'Unassigned'}`,
    '',
    `Open in the tool: ${appUrl.replace(/\/+$/, '')}/schools/${w.schoolId}?tab=Workshops`,
    '',
    'Kept up to date automatically by the codevidhya ops tool. Change workshops there, not here.',
  ]
    .filter((line) => line !== null)
    .join('\n');
  return {
    summary: `${mark}${s.name}: ${w.topic}${w.targetGrades ? ` (grades ${w.targetGrades})` : ''}`,
    description,
    location: [s.city, s.state].filter(Boolean).join(', ') || undefined,
    start: { dateTime: w.scheduledAt.toISOString(), timeZone: APP_TIMEZONE },
    end: { dateTime: end.toISOString(), timeZone: APP_TIMEZONE },
    colorId,
    status: 'confirmed',
  };
}

// One shared Google Calendar ("codevidhya Workshops") that the tool keeps in
// step with its workshops and school holidays, plus one per account manager
// with only their schools (tool roles carry over to Google). It signs in as a Google
// service account the calendar is shared with. Every sync is best-effort:
// a Google outage or missing setup must never fail the workshop change
// itself, and the daily agent run re-syncs everything as a safety net.
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private token: { value: string; expiresAt: number } | null = null;
  private lastError: string | null = null;
  private lastSyncedAt: Date | null = null;
  private lastAccess: AccessRow[] = [];
  /** The sync in progress for each workshop / holiday, so a newer one waits for it. */
  private running = new Map<string, Promise<void>>();
  /** Read once: undefined until first use, null when not set up. */
  private account: ServiceAccount | null | undefined;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return !!this.calendarId() && !!this.serviceAccount();
  }

  /** What the Calendar page shows `viewer`: their own Google calendar link, plus (for admins) who has access. */
  async status(viewer?: StaffJwtPayload) {
    const main = this.calendarId();
    let mine: string | null = main ?? null;
    if (viewer?.role === StaffRole.ACCOUNT_MANAGER) {
      const me = await this.prisma.staff.findUnique({ where: { id: viewer.sub }, select: { googleCalendarId: true } });
      mine = me?.googleCalendarId ?? null;
    }
    return {
      configured: this.isConfigured(),
      calendarId: main ?? null,
      serviceAccountEmail: this.serviceAccount()?.client_email ?? null,
      openUrl: mine ? calendarUrl(mine) : null,
      myCalendar: viewer?.role === StaffRole.ACCOUNT_MANAGER ? 'own' : 'all',
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      access: viewer?.role === StaffRole.SUPER_ADMIN ? await this.accessList() : undefined,
    };
  }

  /** Who can see what, from the staff list (so it survives a restart), with any error from the last access sync. */
  private async accessList(): Promise<AccessRow[]> {
    const staff = await this.prisma.staff.findMany({
      where: { approvedAt: { not: null } },
      select: { name: true, email: true, role: true, isActive: true, googleCalendarId: true },
      orderBy: { name: 'asc' },
    });
    const errors = new Map(this.lastAccess.filter((a) => a.error).map((a) => [a.email, a.error]));
    return staff.map((s) => ({
      name: s.name,
      email: s.email,
      role: s.role,
      access: !s.isActive ? 'none' : s.role !== StaffRole.ACCOUNT_MANAGER ? 'all schools' : s.googleCalendarId ? 'own schools' : 'none',
      error: errors.get(s.email) ?? null,
    }));
  }

  /** Creates, moves, recolours or removes the workshop's event to match the tool: in the
   * main calendar, and in its school's account manager's own calendar (and no other). */
  async syncWorkshop(workshopId: string): Promise<void> {
    if (!this.isConfigured()) return;
    await this.safely(`workshop ${workshopId}`, async () => {
      const w = await this.prisma.workshop.findUnique({
        where: { id: workshopId },
        include: {
          school: {
            select: {
              name: true,
              city: true,
              state: true,
              ownerName: true,
              ownerPhone: true,
              ownerEmail: true,
              assignedAccountManager: { select: { id: true, name: true, email: true, isActive: true, role: true, googleCalendarId: true } },
            },
          },
        },
      });
      const eventId = googleEventId('workshop', workshopId);
      const live = w && w.status !== WorkshopStatus.CANCELLED;
      const target = live ? await this.managerCalendarFor(w.school.assignedAccountManager) : null;
      await this.putEverywhere(eventId, live ? workshopEvent(w, this.appUrl()) : null, target);
    });
  }

  /** An all-day "🏖 School: note" event for a holiday the school marked, or removes it. */
  async syncHoliday(schoolId: string, day: Date): Promise<void> {
    if (!this.isConfigured()) return;
    const iso = isoDateInZone(day);
    await this.safely(`holiday ${schoolId} ${iso}`, async () => {
      const eventId = googleEventId('holiday', `${schoolId}:${iso}`);
      const holiday = await this.prisma.schoolBlockedDate.findUnique({
        where: { schoolId_day: { schoolId, day } },
        include: {
          school: {
            select: {
              name: true,
              assignedAccountManager: { select: { id: true, name: true, email: true, isActive: true, role: true, googleCalendarId: true } },
            },
          },
        },
      });
      const next = isoDateInZone(new Date(day.getTime() + 36 * 60 * 60 * 1000));
      const event = holiday && {
        summary: `🏖 ${holiday.school.name}: ${holiday.note || 'School holiday'}`,
        description: 'Marked by the school on its codevidhya calendar. No workshop will be scheduled on this day.',
        start: { date: iso },
        end: { date: next },
        colorId: COLOR.grey,
        transparency: 'transparent',
        status: 'confirmed',
      };
      const target = holiday ? await this.managerCalendarFor(holiday.school.assignedAccountManager) : null;
      await this.putEverywhere(eventId, event ?? null, target);
    });
  }

  /** After a school changes account manager: moves its events to the new manager's calendar. */
  async syncSchool(schoolId: string): Promise<void> {
    if (!this.isConfigured()) return;
    const [workshops, holidays] = await Promise.all([
      this.prisma.workshop.findMany({ where: { schoolId }, select: { id: true } }),
      this.prisma.schoolBlockedDate.findMany({ where: { schoolId }, select: { day: true } }),
    ]);
    for (const w of workshops) await this.syncWorkshop(w.id);
    for (const h of holidays) await this.syncHoliday(schoolId, h.day);
  }

  /** Who in the tool can see what in Google Calendar, following their role:
   * account managers get their own calendar with only their schools; every
   * other active staff member can view the main calendar; anyone deactivated
   * loses access. Safe to run any time (it only adds or removes what differs). */
  async syncAccess(): Promise<AccessRow[]> {
    if (!this.isConfigured()) return [];
    const main = this.calendarId()!;
    const staff = await this.prisma.staff.findMany({
      where: { approvedAt: { not: null } },
      select: { id: true, name: true, email: true, role: true, isActive: true, googleCalendarId: true },
      orderBy: { name: 'asc' },
    });
    const mainRules = await this.aclRoles(main);
    const rows: AccessRow[] = [];
    for (const s of staff) {
      const email = s.email.toLowerCase();
      const row: AccessRow = { name: s.name, email: s.email, role: s.role, access: 'none', error: null };
      try {
        const wantsMain = s.isActive && s.role !== StaffRole.ACCOUNT_MANAGER;
        const has = mainRules.get(email);
        if (wantsMain && !has) await this.share(main, email);
        // Only take away the view access we gave; never an owner's or editor's.
        if (!wantsMain && has === 'reader') await this.unshare(main, email);
        if (wantsMain) row.access = 'all schools';

        if (s.isActive && s.role === StaffRole.ACCOUNT_MANAGER) {
          const own = await this.managerCalendarFor(s);
          if (own) row.access = 'own schools';
        } else if (s.googleCalendarId) {
          await this.removeCalendar(s.googleCalendarId);
          await this.prisma.staff.update({ where: { id: s.id }, data: { googleCalendarId: null } });
        }
      } catch (err) {
        row.error = err instanceof Error ? err.message : String(err);
      }
      rows.push(row);
    }
    this.lastAccess = rows;
    return rows;
  }

  /** Daily safety net (and the "Sync now" button): access first, then every upcoming workshop and holiday. */
  async syncAll(now = new Date()): Promise<number> {
    if (!this.isConfigured()) return 0;
    await this.safely('access', async () => {
      await this.syncAccess();
    });
    const until = new Date(now.getTime() + SYNC_AHEAD_DAYS * 24 * 60 * 60 * 1000);
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [workshops, holidays] = await Promise.all([
      this.prisma.workshop.findMany({ where: { scheduledAt: { gte: since, lte: until } }, select: { id: true } }),
      this.prisma.schoolBlockedDate.findMany({ where: { day: { gte: since, lte: until } }, select: { schoolId: true, day: true } }),
    ]);
    for (const w of workshops) await this.syncWorkshop(w.id);
    for (const h of holidays) await this.syncHoliday(h.schoolId, h.day);
    return workshops.length + holidays.length;
  }

  /** The daily agent run's step: same as syncAll. */
  scan(): Promise<number> {
    return this.syncAll();
  }

  // ── Calendars and sharing ───────────────────────────────────────────────

  /** The manager's own calendar, made (and shared with them) the first time it's needed. */
  private async managerCalendarFor(
    manager: { id: string; name: string; email: string; isActive: boolean; role: StaffRole; googleCalendarId: string | null } | null,
  ): Promise<string | null> {
    if (!manager?.isActive || manager.role !== StaffRole.ACCOUNT_MANAGER) return null;
    if (manager.googleCalendarId) return manager.googleCalendarId;
    const created = await this.call('POST', `${API}/calendars`, {
      summary: `codevidhya Workshops — ${manager.name}`,
      description: `Workshops and holidays of ${manager.name}'s schools, kept up to date automatically by the codevidhya ops tool.`,
      timeZone: APP_TIMEZONE,
    });
    this.ok(created, 'create a calendar');
    const id = (JSON.parse(created.text) as { id: string }).id;
    await this.prisma.staff.update({ where: { id: manager.id }, data: { googleCalendarId: id } });
    await this.share(id, manager.email.toLowerCase());
    return id;
  }

  /** Puts the event in the main calendar and `managerCalendar`, and removes it from every other manager's calendar. */
  private async putEverywhere(eventId: string, event: Record<string, unknown> | null, managerCalendar: string | null) {
    const others = await this.prisma.staff.findMany({ where: { googleCalendarId: { not: null } }, select: { googleCalendarId: true } });
    const main = this.calendarId()!;
    if (event) await this.upsertEvent(main, eventId, event);
    else await this.deleteEvent(main, eventId);
    for (const { googleCalendarId } of others) {
      if (googleCalendarId === managerCalendar) continue;
      await this.deleteEvent(googleCalendarId!, eventId);
    }
    if (managerCalendar && event) await this.upsertEvent(managerCalendar, eventId, event);
  }

  private async aclRoles(calendarId: string): Promise<Map<string, string>> {
    const res = await this.call('GET', `${API}/calendars/${encodeURIComponent(calendarId)}/acl`);
    this.ok(res, 'read who the calendar is shared with');
    const items = (JSON.parse(res.text) as { items?: { role: string; scope: { type: string; value?: string } }[] }).items ?? [];
    return new Map(items.filter((i) => i.scope.type === 'user' && i.scope.value).map((i) => [i.scope.value!.toLowerCase(), i.role]));
  }

  private async share(calendarId: string, email: string) {
    const res = await this.call('POST', `${API}/calendars/${encodeURIComponent(calendarId)}/acl?sendNotifications=true`, {
      role: 'reader',
      scope: { type: 'user', value: email },
    });
    this.ok(res, `share the calendar with ${email}`);
  }

  private async unshare(calendarId: string, email: string) {
    const res = await this.call('DELETE', `${API}/calendars/${encodeURIComponent(calendarId)}/acl/${encodeURIComponent(`user:${email}`)}`);
    if (res.status === 404) return;
    this.ok(res, `stop sharing the calendar with ${email}`);
  }

  private async removeCalendar(calendarId: string) {
    const res = await this.call('DELETE', `${API}/calendars/${encodeURIComponent(calendarId)}`);
    if (res.status === 404 || res.status === 410) return;
    this.ok(res, 'delete a calendar');
  }

  // ── Google Calendar API ─────────────────────────────────────────────────

  // Update first (also revives an event deleted earlier with the same id); insert if it never existed.
  private async upsertEvent(calendarId: string, eventId: string, event: Record<string, unknown>) {
    const base = `${API}/calendars/${encodeURIComponent(calendarId)}/events`;
    const updated = await this.call('PUT', `${base}/${eventId}`, event);
    if (updated.status !== 404) return this.ok(updated, 'update event');
    this.ok(await this.call('POST', base, { id: eventId, ...event }), 'create event');
  }

  private async deleteEvent(calendarId: string, eventId: string) {
    const res = await this.call('DELETE', `${API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
    if (res.status === 404 || res.status === 410) return; // already gone
    this.ok(res, 'delete event');
  }

  private async call(method: string, url: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, text: await res.text() };
  }

  private ok(res: { status: number; text: string }, what: string) {
    if (res.status >= 200 && res.status < 300) return;
    let message = res.text;
    try {
      message = JSON.parse(res.text).error?.message ?? res.text;
    } catch {
      // not JSON
    }
    throw new Error(`Google Calendar could not ${what} (${res.status}): ${message}`);
  }

  // Service-account sign-in: a JWT signed with the account's private key, swapped for an hour-long access token.
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const account = this.serviceAccount()!;
    const now = Math.floor(Date.now() / 1000);
    const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    });
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
    if (!data.access_token) throw new Error(`Google sign-in failed: ${data.error_description ?? data.error ?? res.status}`);
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  // Syncs of the same thing run one after another, never at once: a holiday
  // added and removed seconds apart would otherwise race, and the slower
  // "add" could put the event back after the "remove". Each run re-reads the
  // database, so the last one always leaves Google matching the tool.
  private async safely(what: string, fn: () => Promise<void>) {
    const previous = this.running.get(what) ?? Promise.resolve();
    const run = previous.then(async () => {
      try {
        await fn();
        this.lastError = null;
        this.lastSyncedAt = new Date();
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Google Calendar sync failed for ${what}: ${this.lastError}`);
      }
    });
    this.running.set(what, run);
    await run;
    if (this.running.get(what) === run) this.running.delete(what);
  }

  private calendarId() {
    return this.config.get<string>('GOOGLE_CALENDAR_ID')?.trim() || undefined;
  }

  // GOOGLE_SERVICE_ACCOUNT_KEY_FILE (path to the downloaded .json key, handy locally) or
  // GOOGLE_SERVICE_ACCOUNT_JSON (the key file's contents, for Render's environment settings).
  private serviceAccount(): ServiceAccount | undefined {
    if (this.account === undefined) this.account = this.loadServiceAccount() ?? null;
    return this.account ?? undefined;
  }

  private loadServiceAccount(): ServiceAccount | undefined {
    try {
      const file = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_FILE')?.trim();
      const json = file ? readFileSync(file, 'utf8') : this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON');
      if (!json) return undefined;
      const parsed = JSON.parse(json) as Partial<ServiceAccount>;
      return parsed.client_email && parsed.private_key ? { client_email: parsed.client_email, private_key: parsed.private_key } : undefined;
    } catch {
      return undefined;
    }
  }

  private appUrl() {
    return this.config.get<string>('APP_URL') || 'http://localhost:5173';
  }
}
