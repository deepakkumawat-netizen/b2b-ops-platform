import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkshopStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { schoolScopeWhere } from '../common/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { SchoolAutomationService } from '../automation/school-automation.service';
import { StaffNotificationsService } from '../staff-notifications/staff-notifications.service';
import { LIVE_WORKSHOP_STATUSES } from '../workshops/workshops.service';
import { workshopResponseToken } from '../workshops/workshop-response-token';
import { formatDateInZone, formatInZone, isoDateInZone, startOfDayInZone } from '../common/time';
import { schoolCalendarUrl } from './school-calendar-token';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-05" → midnight of that day in the business timezone (noon UTC is the same day in India). */
export function dayFromIso(iso: string): Date {
  return startOfDayInZone(new Date(`${iso}T12:00:00Z`));
}

// One calendar, two views: staff see every school they can access; a school
// sees only its own workshops and marks its holidays. Every change the
// workshop agents make shows up here because both read the Workshop rows.
@Injectable()
export class CalendarService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
    private activity: ActivityService,
    private automation: SchoolAutomationService,
    private staffNotifications: StaffNotificationsService,
    private google: GoogleCalendarService,
  ) {}

  calendarLink(schoolId: string) {
    return schoolCalendarUrl(this.appUrl(), schoolId, this.secret());
  }

  /** Staff calendar: workshops (not cancelled) and school holidays between `from` and `to`. */
  async forStaff(staff: StaffJwtPayload, fromIso: string, toIso: string) {
    const from = dayFromIso(fromIso);
    const to = new Date(dayFromIso(toIso).getTime() + DAY_MS);
    const school = schoolScopeWhere(staff);
    const [workshops, holidays] = await Promise.all([
      this.prisma.workshop.findMany({
        where: { school, status: { not: WorkshopStatus.CANCELLED }, scheduledAt: { gte: from, lt: to } },
        include: { school: { select: { name: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.schoolBlockedDate.findMany({
        where: { school, day: { gte: from, lt: to } },
        include: { school: { select: { name: true } } },
        orderBy: { day: 'asc' },
      }),
    ]);
    return {
      workshops: workshops.map((w) => ({
        id: w.id,
        schoolId: w.schoolId,
        schoolName: w.school.name,
        topic: w.topic,
        targetGrades: w.targetGrades,
        scheduledAt: w.scheduledAt,
        status: w.status,
        schoolConfirmed: !!w.schoolConfirmedAt,
        changeRequested: !!w.changeRequestedAt,
      })),
      holidays: holidays.map((h) => ({ schoolId: h.schoolId, schoolName: h.school.name, date: isoDateInZone(h.day), note: h.note })),
    };
  }

  /** The school's own calendar: all its workshops that aren't cancelled, and its holidays. */
  async forSchool(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        workshops: { where: { status: { not: WorkshopStatus.CANCELLED } }, orderBy: { scheduledAt: 'asc' } },
        blockedDates: { orderBy: { day: 'asc' } },
      },
    });
    if (!school) throw new NotFoundException();
    const secret = this.secret();
    return {
      schoolName: school.name,
      today: isoDateInZone(new Date()),
      workshops: school.workshops.map((w) => ({
        id: w.id,
        topic: w.topic,
        targetGrades: w.targetGrades,
        scheduledAt: w.scheduledAt,
        status: w.status,
        schoolConfirmed: !!w.schoolConfirmedAt,
        // Path of its "confirm or change this date" page, for live workshops only.
        responsePath: LIVE_WORKSHOP_STATUSES.includes(w.status) ? `/workshop/${w.id}/${workshopResponseToken(w.id, secret)}` : null,
      })),
      holidays: school.blockedDates.map((h) => ({ date: isoDateInZone(h.day), note: h.note })),
    };
  }

  /** The school marks a day as a holiday / not available. If a workshop is
   * already on that day, the manager is emailed and the bell lights up, and
   * the school is told to move it. */
  async addHoliday(schoolId: string, dateIso: string, note: string | null) {
    const day = dayFromIso(dateIso);
    await this.prisma.schoolBlockedDate.upsert({
      where: { schoolId_day: { schoolId, day } },
      create: { schoolId, day, note },
      update: { note },
    });
    void this.google.syncHoliday(schoolId, day);
    const [school, clashes] = await Promise.all([
      this.prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true } }),
      this.prisma.workshop.findMany({
        where: { schoolId, status: { in: LIVE_WORKSHOP_STATUSES }, scheduledAt: { gte: day, lt: new Date(day.getTime() + DAY_MS) } },
        select: { id: true, topic: true, scheduledAt: true },
      }),
    ]);
    const when = formatDateInZone(day);
    const label = note ? ` ("${note}")` : '';
    await this.activity.record(schoolId, null, `School marked ${when} as a holiday on its calendar`, note);
    if (clashes.length === 0) {
      await this.staffNotifications.notify(schoolId, 'SCHOOL_HOLIDAY_ADDED', `${school.name} marked ${when} as a holiday`, note);
      return { clashes: [] };
    }
    const list = clashes.map((w) => `"${w.topic}" at ${formatInZone(w.scheduledAt)}`).join(', ');
    await this.staffNotifications.notify(
      schoolId,
      'SCHOOL_HOLIDAY_CLASH',
      `${school.name} marked ${when} as a holiday, but a workshop is that day`,
      `${list}${label}. The school has been asked to move it.`,
    );
    const { recipients, managerName } = await this.automation.managerRecipients(schoolId);
    await Promise.all(
      recipients.map((recipient) =>
        this.notifications.sendTemplateEmail({
          schoolId,
          recipient,
          templateKey: 'school_holiday_clash_manager',
          subject: `${school.name} marked ${when} as a holiday, but a workshop is that day`,
          body:
            `Hi ${managerName ?? 'team'},\n\n${school.name} marked ${when} as a holiday on its calendar${label}, ` +
            `but it has ${list} on that day.\n\nThe school has been asked to pick a new date; if it does, the agent will move the workshop automatically. ` +
            `If the school doesn't respond, please call them.`,
          fromAccountManager: false,
        }),
      ),
    );
    return { clashes: clashes.map((w) => ({ id: w.id, topic: w.topic, scheduledAt: w.scheduledAt })) };
  }

  async removeHoliday(schoolId: string, dateIso: string) {
    const day = dayFromIso(dateIso);
    const { count } = await this.prisma.schoolBlockedDate.deleteMany({ where: { schoolId, day } });
    void this.google.syncHoliday(schoolId, day);
    if (count > 0) await this.activity.record(schoolId, null, `School removed the holiday on ${formatDateInZone(day)} from its calendar`);
    return { removed: count };
  }

  /** Emails the school its calendar link (the Workshops tab's button). */
  async sendLinkToSchool(schoolId: string) {
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, ownerName: true, ownerEmail: true } });
    const link = this.calendarLink(schoolId);
    const sent = await this.notifications.sendTemplateEmail({
      schoolId,
      recipient: school.ownerEmail,
      templateKey: 'school_calendar_link',
      subject: `Your workshop calendar — ${school.name}`,
      body:
        `Dear ${school.ownerName ?? 'Team'},\n\nHere is your codevidhya workshop calendar. It always shows your latest workshop dates.\n\n` +
        `Please mark your school holidays, exam weeks and any other days that don't suit you, so we never schedule a workshop on them. ` +
        `You can also confirm or change a workshop date from there.\n\n${link}\n\nTeam codevidhya`,
      button: { label: 'Open my calendar', url: link },
    });
    return { sent };
  }

  private appUrl() {
    return this.config.get<string>('APP_URL') || 'http://localhost:5173';
  }

  private secret() {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }
}
