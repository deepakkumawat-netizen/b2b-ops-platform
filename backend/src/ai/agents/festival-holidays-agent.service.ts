import { Injectable, Logger } from '@nestjs/common';
import { SchoolStatus } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../../activity/activity.service';
import { SchoolAutomationService } from '../../automation/school-automation.service';
import { StaffNotificationsService } from '../../staff-notifications/staff-notifications.service';
import { LIVE_WORKSHOP_STATUSES } from '../../workshops/workshops.service';
import { formatDateInZone, formatInZone, startOfDayInZone } from '../../common/time';
import { INDIAN_FESTIVALS } from './indian-festivals';

/** Festivals this far ahead go on the calendar. */
export const FESTIVAL_LOOKAHEAD_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The festivals from today up to FESTIVAL_LOOKAHEAD_DAYS out, as business-timezone midnights. */
export function upcomingFestivals(now: Date): { day: Date; name: string }[] {
  const from = startOfDayInZone(now);
  const to = new Date(from.getTime() + FESTIVAL_LOOKAHEAD_DAYS * DAY_MS);
  return INDIAN_FESTIVALS.map((f) => ({ day: startOfDayInZone(new Date(`${f.date}T12:00:00Z`)), name: f.name })).filter(
    (f) => f.day >= from && f.day < to,
  );
}

// Fully autonomous: marks Indian festivals and national holidays (see
// indian-festivals.ts) as holidays on every active school's calendar, so the
// workshop scheduler and rescheduler agents never pick those days. Each
// festival is added to a school once: if the school removes it from its
// calendar (it's open that day), it stays removed. If a workshop is already
// on a festival day, the manager is emailed and the bell lights up.
@Injectable()
export class FestivalHolidaysAgentService {
  private readonly logger = new Logger(FestivalHolidaysAgentService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activity: ActivityService,
    private automation: SchoolAutomationService,
    private staffNotifications: StaffNotificationsService,
  ) {}

  async scan(now = new Date()): Promise<number> {
    const festivals = upcomingFestivals(now);
    if (festivals.length === 0) return 0;
    const schools = await this.prisma.school.findMany({
      where: { status: SchoolStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        festivalsApplied: { where: { day: { in: festivals.map((f) => f.day) } }, select: { day: true } },
      },
    });
    let added = 0;
    for (const school of schools) {
      const done = new Set(school.festivalsApplied.map((f) => f.day.getTime()));
      const missing = festivals.filter((f) => !done.has(f.day.getTime()));
      if (missing.length === 0) continue;
      try {
        added += await this.applyTo(school, missing);
      } catch (err) {
        this.logger.warn(`Festival holidays failed for ${school.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return added;
  }

  private async applyTo(school: { id: string; name: string }, festivals: { day: Date; name: string }[]): Promise<number> {
    const added: { day: Date; name: string }[] = [];
    for (const f of festivals) {
      // A day the school already marked keeps the school's own note.
      const existing = await this.prisma.schoolBlockedDate.findUnique({ where: { schoolId_day: { schoolId: school.id, day: f.day } } });
      if (!existing) {
        await this.prisma.schoolBlockedDate.create({ data: { schoolId: school.id, day: f.day, note: f.name } });
        added.push(f);
      }
      await this.prisma.schoolFestivalApplied.create({ data: { schoolId: school.id, day: f.day } });
    }
    if (added.length === 0) return 0;

    await this.activity.record(
      school.id,
      null,
      `Agent marked ${added.length} festival holiday(s) on the school's calendar`,
      added.map((f) => `${f.name}: ${formatDateInZone(f.day)}`).join('\n'),
    );

    const clashes = await this.prisma.workshop.findMany({
      where: {
        schoolId: school.id,
        status: { in: LIVE_WORKSHOP_STATUSES },
        OR: added.map((f) => ({ scheduledAt: { gte: f.day, lt: new Date(f.day.getTime() + DAY_MS) } })),
      },
      select: { topic: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
    });
    if (clashes.length === 0) return added.length;

    const festivalOn = (at: Date) => added.find((f) => f.day.getTime() === startOfDayInZone(at).getTime())?.name ?? 'a festival';
    const lines = clashes.map((w) => `"${w.topic}" at ${formatInZone(w.scheduledAt)} (${festivalOn(w.scheduledAt)})`);
    const title = `${school.name}: ${clashes.length} workshop(s) fall on a festival`;
    await this.staffNotifications.notify(school.id, 'FESTIVAL_CLASH', title, lines.join(' · '));
    const { recipients, managerName } = await this.automation.managerRecipients(school.id);
    await Promise.all(
      recipients.map((recipient) =>
        this.notifications.sendTemplateEmail({
          schoolId: school.id,
          recipient,
          templateKey: 'festival_clash_manager',
          subject: title,
          body:
            `Hi ${managerName ?? 'team'},\n\nThe festival holidays agent marked festivals on ${school.name}'s calendar, ` +
            `and these workshops fall on one:\n\n${lines.join('\n')}\n\nPlease check with the school and move them if it's closed that day. ` +
            `If the school is open, remove the holiday from its calendar.`,
          fromAccountManager: false,
        }),
      ),
    );
    return added.length;
  }
}
