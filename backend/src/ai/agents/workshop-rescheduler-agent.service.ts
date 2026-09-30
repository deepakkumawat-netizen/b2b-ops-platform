import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../../activity/activity.service';
import { SchoolAutomationService } from '../../automation/school-automation.service';
import { LIVE_WORKSHOP_STATUSES, WorkshopsService } from '../../workshops/workshops.service';
import { formatDateInZone, formatInZone, startOfDayInZone } from '../../common/time';
import { StaffNotificationsService } from '../../staff-notifications/staff-notifications.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

/** A new date must be at least this many days away, so the school and the trainer can prepare. */
export const MIN_LEAD_DAYS = 2;
/** After this many automatic moves of one workshop, the account manager takes over. */
export const MAX_AUTO_RESCHEDULES = 3;

/** The first of the school's preferred days that works: far enough ahead,
 * not a day the school already has another workshop or marked as a
 * holiday on its calendar. Keeps the
 * workshop's original time of day. */
export function pickRescheduleDate(params: {
  preferredDays: Date[];
  currentAt: Date;
  otherWorkshopDays: Date[];
  /** Holidays / busy days the school marked on its calendar. */
  blockedDays?: Date[];
  now: Date;
}): Date | null {
  const { preferredDays, currentAt, otherWorkshopDays, blockedDays = [], now } = params;
  const timeOfDay = currentAt.getTime() - startOfDayInZone(currentAt).getTime();
  const earliest = startOfDayInZone(now, MIN_LEAD_DAYS).getTime();
  const taken = new Set([currentAt, ...otherWorkshopDays, ...blockedDays].map((d) => startOfDayInZone(d).getTime()));
  for (const preferred of preferredDays) {
    const day = startOfDayInZone(preferred).getTime();
    if (day < earliest || taken.has(day)) continue;
    return new Date(day + timeOfDay);
  }
  return null;
}

export type RescheduleOutcome = 'rescheduled' | 'asked_again' | 'needs_manager' | 'nothing';

// Fully autonomous and school-facing. When a school answers "please change
// the date" on its workshop link, this moves the workshop to the school's
// first workable preferred date and emails the school the new date (with
// the same link, so it can confirm or ask again). Runs straight away from
// the school's request, and again in the daily run as a safety net for any
// request that failed mid-way. The account manager is emailed at every
// step, and takes over after MAX_AUTO_RESCHEDULES moves so a workshop can't
// bounce around forever.
@Injectable()
export class WorkshopReschedulerAgentService {
  private readonly logger = new Logger(WorkshopReschedulerAgentService.name);

  constructor(
    private prisma: PrismaService,
    private workshops: WorkshopsService,
    private notifications: NotificationsService,
    private activity: ActivityService,
    private automation: SchoolAutomationService,
    private suggestions: AgentSuggestionsService,
    private staffNotifications: StaffNotificationsService,
  ) {}

  async scan(now = new Date()): Promise<number> {
    const pending = await this.prisma.workshop.findMany({
      where: { status: { in: LIVE_WORKSHOP_STATUSES }, changeRequestedAt: { not: null }, preferredDates: { isEmpty: false } },
      select: { id: true },
    });
    let handled = 0;
    for (const { id } of pending) {
      try {
        if ((await this.handleRequest(id, now)) !== 'nothing') handled += 1;
      } catch (err) {
        this.logger.warn(`Workshop reschedule failed for ${id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return handled;
  }

  async handleRequest(workshopId: string, now = new Date()): Promise<RescheduleOutcome> {
    const workshop = await this.prisma.workshop.findUnique({
      where: { id: workshopId },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            ownerName: true,
            ownerEmail: true,
            workshops: { where: { id: { not: workshopId }, status: { in: LIVE_WORKSHOP_STATUSES } }, select: { scheduledAt: true } },
            blockedDates: { select: { day: true } },
          },
        },
      },
    });
    if (!workshop || !LIVE_WORKSHOP_STATUSES.includes(workshop.status) || !workshop.changeRequestedAt || workshop.preferredDates.length === 0) {
      return 'nothing';
    }
    const { school } = workshop;
    const reason = workshop.changeReason ? `"${workshop.changeReason}"` : 'no reason given';
    const asked = workshop.preferredDates.map((d) => formatDateInZone(d)).join(' or ');

    if (workshop.autoRescheduleCount >= MAX_AUTO_RESCHEDULES) {
      // Keep the request (and its reason) showing; drop the dates so the daily run doesn't retry it.
      await this.prisma.workshop.update({ where: { id: workshop.id }, data: { preferredDates: [] } });
      await this.emailManager(
        school.id,
        'workshop_reschedule_needs_manager',
        `Action needed: ${school.name} wants to move "${workshop.topic}" again`,
        `${school.name} asked to move the workshop "${workshop.topic}" (now ${formatInZone(workshop.scheduledAt)}) to ${asked}. Reason: ${reason}.\n\n` +
          `It has already been moved automatically ${workshop.autoRescheduleCount} times, so the agent has stopped. ` +
          `Please call the school and use Reschedule in the tool once you've agreed a date.`,
      );
      await this.log(
        school.id,
        SuggestionType.WORKSHOP_RESCHEDULE_NEEDS_MANAGER,
        `Workshop reschedule handed to manager — ${school.name}`,
        `"${workshop.topic}": the school asked for ${asked}, but it was already moved ${workshop.autoRescheduleCount} times.`,
        `Limit of ${MAX_AUTO_RESCHEDULES} automatic moves reached.`,
      );
      await this.staffNotifications.notify(
        school.id,
        'WORKSHOP_NEEDS_MANAGER',
        `Action needed: ${school.name} wants to move "${workshop.topic}" again`,
        `Asked for ${asked}. Reason: ${reason}. Already moved ${workshop.autoRescheduleCount} times, so please call the school.`,
      );
      return 'needs_manager';
    }

    const newAt = pickRescheduleDate({
      preferredDays: workshop.preferredDates,
      currentAt: workshop.scheduledAt,
      otherWorkshopDays: school.workshops.map((w) => w.scheduledAt),
      blockedDays: school.blockedDates.map((b) => b.day),
      now,
    });

    if (!newAt) {
      // None of the dates work, so ask the school for new ones with the same link.
      await this.prisma.workshop.update({ where: { id: workshop.id }, data: { changeRequestedAt: null, preferredDates: [] } });
      await this.notifications.sendTemplateEmail({
        schoolId: school.id,
        recipient: school.ownerEmail,
        templateKey: 'workshop_reschedule_dates_unavailable',
        subject: `Please pick another date — ${school.name}`,
        body:
          `Dear ${school.ownerName ?? 'Team'},\n\nThank you for letting us know that ${formatInZone(workshop.scheduledAt)} doesn't suit you for the workshop "${workshop.topic}". ` +
          `Unfortunately we can't use ${asked}: a new date needs to be at least ${MIN_LEAD_DAYS} days away, on a day without another workshop or a holiday on your calendar.\n\n` +
          `Please use the button below to pick different dates. Until then, the workshop stays on ${formatInZone(workshop.scheduledAt)}.\n\n` +
          `All your workshop dates, and a place to mark your holidays: ${this.workshops.calendarLink(school.id)}\n\nTeam codevidhya`,
        button: { label: 'Pick different dates', url: this.workshops.responseLink(workshop.id) },
      });
      await this.emailManager(
        school.id,
        'workshop_reschedule_dates_unavailable_manager',
        `${school.name} asked to move "${workshop.topic}" — dates didn't work`,
        `${school.name} asked to move the workshop "${workshop.topic}" (${formatInZone(workshop.scheduledAt)}) to ${asked}. Reason: ${reason}.\n\n` +
          `None of those dates could be used (too soon, another workshop that day, or a school holiday), so the agent has asked the school to pick again. No action needed from you yet.`,
      );
      await this.activity.record(school.id, null, `Agent asked the school for other dates for "${workshop.topic}"`, `Couldn't use ${asked}`);
      await this.log(
        school.id,
        SuggestionType.WORKSHOP_AUTO_RESCHEDULED,
        `Asked school for other workshop dates — ${school.name}`,
        `"${workshop.topic}": ${asked} couldn't be used, so the school was asked to pick again.`,
        `Every preferred date was under ${MIN_LEAD_DAYS} days away, clashed with another workshop, or is a school holiday.`,
      );
      await this.staffNotifications.notify(
        school.id,
        'WORKSHOP_DATES_UNAVAILABLE',
        `${school.name} asked to move "${workshop.topic}", but the dates didn't work`,
        `Asked for ${asked}. Reason: ${reason}. The school has been asked to pick again.`,
      );
      return 'asked_again';
    }

    const oldAt = workshop.scheduledAt;
    const result = await this.workshops.reschedule(school.id, workshop.id, {
      scheduledAt: newAt.toISOString(),
      reason: workshop.changeReason ? `Requested by your team: ${workshop.changeReason}` : 'Requested by your team',
    });
    await this.prisma.workshop.update({ where: { id: workshop.id }, data: { autoRescheduleCount: { increment: 1 } } });
    const schoolEmailed = result.confirmationSentAt
      ? 'emailed the school the new date.'
      : "tried to email the school the new date, but the email didn't go out. Check the school's Activity tab.";
    await this.emailManager(
      school.id,
      'workshop_auto_rescheduled_manager',
      `"${workshop.topic}" moved to ${formatInZone(newAt)} — ${school.name}`,
      `${school.name} asked to move the workshop "${workshop.topic}". Reason: ${reason}.\n\n` +
        `The agent moved it from ${formatInZone(oldAt)} to ${formatInZone(newAt)} (the school's choice) and ${schoolEmailed}\n\n` +
        `Please make sure the trainer is free on the new date. The day-before reminder will go out automatically.`,
    );
    await this.activity.record(school.id, null, `Agent moved "${workshop.topic}" to ${formatInZone(newAt)}`, `Asked by the school: ${reason}`);
    await this.log(
      school.id,
      SuggestionType.WORKSHOP_AUTO_RESCHEDULED,
      `Workshop auto-rescheduled — ${school.name}`,
      `Moved "${workshop.topic}" from ${formatInZone(oldAt)} to ${formatInZone(newAt)} at the school's request.`,
      `The school asked for ${asked}; reason: ${reason}.`,
    );
    await this.staffNotifications.notify(
      school.id,
      'WORKSHOP_MOVED',
      `${school.name} moved "${workshop.topic}" to ${formatInZone(newAt)}`,
      `Was ${formatInZone(oldAt)}. Reason: ${reason}.`,
    );
    return 'rescheduled';
  }

  /** Tells the manager the school confirmed the date, the last step of the loop. */
  async notifySchoolConfirmed(workshopId: string) {
    const workshop = await this.prisma.workshop.findUnique({ where: { id: workshopId }, include: { school: { select: { id: true, name: true } } } });
    if (!workshop) return;
    await this.emailManager(
      workshop.school.id,
      'workshop_school_confirmed_manager',
      `${workshop.school.name} confirmed "${workshop.topic}" on ${formatInZone(workshop.scheduledAt)}`,
      `${workshop.school.name} confirmed the workshop "${workshop.topic}" on ${formatInZone(workshop.scheduledAt)}. No action needed.`,
    );
    await this.staffNotifications.notify(
      workshop.school.id,
      'WORKSHOP_CONFIRMED',
      `${workshop.school.name} confirmed "${workshop.topic}"`,
      `On ${formatInZone(workshop.scheduledAt)}.`,
    );
  }

  private async emailManager(schoolId: string, templateKey: string, subject: string, text: string) {
    const { recipients, managerName } = await this.automation.managerRecipients(schoolId);
    await Promise.all(
      recipients.map((recipient) =>
        this.notifications.sendTemplateEmail({
          schoolId,
          recipient,
          templateKey,
          subject,
          body: `Hi ${managerName ?? 'team'},\n\n${text}`,
          fromAccountManager: false,
        }),
      ),
    );
  }

  private log(schoolId: string, suggestionType: SuggestionType, subject: string, body: string, reasoning: string) {
    return this.suggestions.logAutoAction({ schoolId, agentKey: AgentKey.WORKSHOP_RESCHEDULER, suggestionType, subject, body, reasoning });
  }
}
