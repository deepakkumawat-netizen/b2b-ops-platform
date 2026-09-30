import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SchoolLifecyclePhase, SchoolStatus, SuggestionType, WorkshopStatus } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkshopsService } from '../../workshops/workshops.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../../activity/activity.service';
import { SchoolAutomationService } from '../../automation/school-automation.service';
import { StaffNotificationsService } from '../../staff-notifications/staff-notifications.service';
import { formatInZone, isoDateInZone, startOfDayInZone } from '../../common/time';
import { AgentSuggestionsService } from '../agent-suggestions.service';

/** The first workshop is at least this far away, so the school can plan for it. */
export const FIRST_WORKSHOP_AFTER_DAYS = 14;
/** Workshops are at least this far apart. */
export const MIN_DAYS_BETWEEN = 7;
/** Workshops start at this time (business timezone). */
export const WORKSHOP_HOUR = 11;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** 31 March (the end of the Indian school year) that `now` falls before, as midnight in the business timezone. */
export function schoolYearEnd(now: Date): Date {
  const [year, month] = isoDateInZone(now).split('-').map(Number);
  const endYear = month >= 4 ? year + 1 : year;
  return startOfDayInZone(new Date(`${endYear}-03-31T12:00:00Z`));
}

/** Monday–Friday, for a business-timezone midnight. */
function isWeekday(day: Date): boolean {
  const [y, m, d] = isoDateInZone(day).split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

/** `count` workshop start times spread evenly from two weeks out to the end of the
 * school year: weekdays only, never on a school holiday or a day that already
 * has a workshop (any school, so a trainer isn't double-booked), 11:00 am. */
export function planWorkshopTimes(params: { count: number; now: Date; busyDays: Date[]; holidays: Date[]; notBefore?: Date }): Date[] {
  const { count, now, busyDays, holidays } = params;
  if (count <= 0) return [];
  const blocked = new Set([...busyDays, ...holidays].map((d) => startOfDayInZone(d).getTime()));
  let start = startOfDayInZone(now, FIRST_WORKSHOP_AFTER_DAYS);
  if (params.notBefore && params.notBefore > start) start = startOfDayInZone(params.notBefore);
  const end = schoolYearEnd(now);
  const windowDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const gap = Math.max(MIN_DAYS_BETWEEN, Math.floor(windowDays / count));

  const times: Date[] = [];
  let target = start;
  for (let i = 0; i < count; i++) {
    let day = target;
    // Next free weekday on or after the target (bounded, in case everything is taken).
    for (let tries = 0; tries < 60 && (!isWeekday(day) || blocked.has(day.getTime())); tries++) {
      day = startOfDayInZone(new Date(day.getTime() + 36 * HOUR_MS));
    }
    blocked.add(day.getTime());
    times.push(new Date(day.getTime() + WORKSHOP_HOUR * HOUR_MS));
    // Keep the even spacing from the planned slot, but never closer than MIN_DAYS_BETWEEN to this one.
    const planned = startOfDayInZone(new Date(target.getTime() + gap * DAY_MS + 12 * HOUR_MS));
    const earliest = startOfDayInZone(new Date(day.getTime() + MIN_DAYS_BETWEEN * DAY_MS + 12 * HOUR_MS));
    target = planned > earliest ? planned : earliest;
  }
  return times;
}

const WORKSHOP_PHASES = new Set<SchoolLifecyclePhase>([SchoolLifecyclePhase.ONGOING_ENGAGEMENT, SchoolLifecyclePhase.COMPETITIONS]);

// Fully autonomous and school-facing (SOP Phase 8.3 "Student Workshops"):
// once a school reaches ongoing engagement, puts the workshops Sales
// committed to (School.workshopsCommitted) on the calendar, spread over the
// rest of the school year, and sends each school the usual confirmation
// email, whose "Confirm or change this date" link hands any date that
// doesn't suit to the workshop rescheduler agent. Only ever adds the
// missing ones, so re-running is safe.
@Injectable()
export class WorkshopSchedulerAgentService {
  private readonly logger = new Logger(WorkshopSchedulerAgentService.name);

  constructor(
    private prisma: PrismaService,
    private workshops: WorkshopsService,
    private notifications: NotificationsService,
    private activity: ActivityService,
    private automation: SchoolAutomationService,
    private staffNotifications: StaffNotificationsService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(now = new Date()): Promise<number> {
    const schools = await this.prisma.school.findMany({
      where: { status: SchoolStatus.ACTIVE, currentPhase: { in: [...WORKSHOP_PHASES] }, workshopsCommitted: { gt: 0 } },
      select: {
        id: true,
        name: true,
        productProgram: true,
        gradeFrom: true,
        gradeTo: true,
        workshopsCommitted: true,
        workshops: { where: { status: { not: WorkshopStatus.CANCELLED } }, select: { scheduledAt: true } },
        blockedDates: { select: { day: true } },
      },
    });
    let scheduled = 0;
    for (const school of schools) {
      const missing = (school.workshopsCommitted ?? 0) - school.workshops.length;
      if (missing <= 0) continue;
      try {
        scheduled += await this.scheduleFor(school, missing, now);
      } catch (err) {
        this.logger.warn(`Workshop scheduling failed for ${school.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return scheduled;
  }

  private async scheduleFor(
    school: {
      id: string;
      name: string;
      productProgram: string | null;
      gradeFrom: string | null;
      gradeTo: string | null;
      workshopsCommitted: number | null;
      workshops: { scheduledAt: Date }[];
      blockedDates: { day: Date }[];
    },
    missing: number,
    now: Date,
  ): Promise<number> {
    const busy = await this.prisma.workshop.findMany({
      where: { status: { not: WorkshopStatus.CANCELLED }, scheduledAt: { gte: startOfDayInZone(now) } },
      select: { scheduledAt: true },
    });
    const own = school.workshops.map((w) => w.scheduledAt).sort((a, b) => a.getTime() - b.getTime());
    const lastOwn = own[own.length - 1];
    const times = planWorkshopTimes({
      count: missing,
      now,
      busyDays: busy.map((w) => w.scheduledAt),
      holidays: school.blockedDates.map((h) => h.day),
      // After any workshop the school already has, with a week's gap.
      notBefore: lastOwn ? new Date(lastOwn.getTime() + MIN_DAYS_BETWEEN * DAY_MS) : undefined,
    });
    const total = school.workshopsCommitted ?? missing;
    const program = school.productProgram?.trim() || 'Student';
    const grades = school.gradeFrom || school.gradeTo ? `${school.gradeFrom ?? '?'}-${school.gradeTo ?? '?'}` : undefined;

    const lines: string[] = [];
    let emailed = 0;
    for (const [i, at] of times.entries()) {
      const n = school.workshops.length + i + 1;
      const created = await this.workshops.create(school.id, {
        topic: `${program} workshop ${n} of ${total}`,
        targetGrades: grades,
        scheduledAt: at.toISOString(),
      });
      // The confirmation email carries the school's "Confirm or change this date" link.
      const confirmed = await this.workshops.confirm(school.id, created.id);
      if (confirmed.confirmationSentAt) emailed += 1;
      lines.push(`${created.topic}: ${formatInZone(at)}`);
    }

    const list = lines.join('\n');
    await this.activity.record(school.id, null, `Agent scheduled ${times.length} workshop(s)`, list);
    await this.staffNotifications.notify(school.id, 'WORKSHOPS_AUTO_SCHEDULED', `${school.name}: ${times.length} workshop(s) scheduled by the agent`, lines.join(' · '));
    const { recipients, managerName } = await this.automation.managerRecipients(school.id);
    await Promise.all(
      recipients.map((recipient) =>
        this.notifications.sendTemplateEmail({
          schoolId: school.id,
          recipient,
          templateKey: 'workshops_auto_scheduled_manager',
          subject: `${times.length} workshop(s) scheduled for ${school.name}`,
          body:
            `Hi ${managerName ?? 'team'},\n\n${school.name} reached ongoing engagement, so the agent scheduled the ${times.length} workshop(s) Sales committed to:\n\n${list}\n\n` +
            `${emailed === times.length ? 'The school has been emailed each date' : `${emailed} of ${times.length} confirmation emails went out (see the Activity tab)`}, ` +
            `with a link to confirm it or ask for another date; if it asks, the agent moves the workshop automatically. Please make sure a trainer is free on these dates.`,
          fromAccountManager: false,
        }),
      ),
    );
    await this.suggestions.logAutoAction({
      schoolId: school.id,
      agentKey: AgentKey.WORKSHOP_SCHEDULER,
      suggestionType: SuggestionType.WORKSHOPS_AUTO_SCHEDULED,
      subject: `${times.length} workshop(s) auto-scheduled — ${school.name}`,
      body: list,
      reasoning: `${total} committed by Sales, ${school.workshops.length} already on the calendar.`,
    });
    return times.length;
  }
}

