import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkshopStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { CancelWorkshopDto } from './dto/cancel-workshop.dto';
import { RescheduleWorkshopDto } from './dto/reschedule-workshop.dto';
import { RecordFeedbackDto } from './dto/record-feedback.dto';
import { formatInZone } from '../common/time';
import { workshopResponseUrl } from './workshop-response-token';
import { schoolCalendarUrl } from '../calendar/school-calendar-token';

/** Still going ahead — the school can confirm it or ask to move it. */
export const LIVE_WORKSHOP_STATUSES: WorkshopStatus[] = [WorkshopStatus.SCHEDULED, WorkshopStatus.CONFIRMED, WorkshopStatus.RESCHEDULED];

// Mirrors the SOP Phase 8.3 communication flow exactly: Scheduled →
// Confirmation → One-Day Reminder → Completion/Thank-You + Feedback Form →
// Feedback Follow-up. Each step's email attempt is logged via
// NotificationsService regardless of whether it actually sends.
@Injectable()
export class WorkshopsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  /** The school's calendar page: all its workshop dates, plus the holidays it marks. */
  calendarLink(schoolId: string) {
    return schoolCalendarUrl(
      this.config.get<string>('APP_URL') || 'http://localhost:5173',
      schoolId,
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    );
  }

  /** The school's "confirm or change this date" page for one workshop. */
  responseLink(workshopId: string) {
    return workshopResponseUrl(
      this.config.get<string>('APP_URL') || 'http://localhost:5173',
      workshopId,
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    );
  }

  listForSchool(schoolId: string) {
    return this.prisma.workshop.findMany({ where: { schoolId }, orderBy: { scheduledAt: 'asc' } });
  }

  async create(schoolId: string, dto: CreateWorkshopDto) {
    const workshop = await this.prisma.workshop.create({
      data: { schoolId, topic: dto.topic, targetGrades: dto.targetGrades, scheduledAt: new Date(dto.scheduledAt) },
    });
    return workshop;
  }

  async update(schoolId: string, workshopId: string, dto: UpdateWorkshopDto) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { ...dto, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined },
    });
    return updated;
  }

  async confirm(schoolId: string, workshopId: string) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { status: WorkshopStatus.CONFIRMED },
    });
    const sent = await this.notifyForWorkshop(
      workshop.schoolId,
      updated,
      'workshop_confirmation',
      'Workshop Confirmed',
      (school) =>
        `Dear ${school.ownerName ?? 'Team'},\n\nThis confirms the workshop "${workshop.topic}" scheduled for ${formatInZone(updated.scheduledAt)}${workshop.targetGrades ? ` for grades ${workshop.targetGrades}` : ''}.\n\nPlease use the button below to confirm this date, or to ask for a different one if it doesn't suit you.\n\nTeam codevidhya`,
      true,
    );
    return await this.markSent(updated, sent, 'confirmationSentAt');
  }

  async remind(schoolId: string, workshopId: string) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const sent = await this.notifyForWorkshop(workshop.schoolId, workshop, 'workshop_reminder', 'Workshop Reminder — Tomorrow', (school) =>
      `Dear ${school.ownerName ?? 'Team'},\n\nA reminder that the workshop "${workshop.topic}" is scheduled for ${formatInZone(workshop.scheduledAt)}.\n\nTeam codevidhya`,
    );
    return this.markSent(workshop, sent, 'reminderSentAt');
  }

  async complete(schoolId: string, workshopId: string) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const now = new Date();
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { status: WorkshopStatus.COMPLETED, completedAt: now },
    });
    const sent = await this.notifyForWorkshop(
      workshop.schoolId,
      updated,
      'workshop_completion',
      'Thank You — Workshop Completed',
      (school) =>
        `Dear ${school.ownerName ?? 'Team'},\n\nThank you for hosting "${workshop.topic}"! We'd love your feedback — please share it via the feedback form shared alongside this email.\n\nTeam codevidhya`,
    );
    return await this.markSent(updated, sent, 'feedbackFormSentAt');
  }

  async nagFeedback(schoolId: string, workshopId: string) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const sent = await this.notifyForWorkshop(
      workshop.schoolId,
      workshop,
      'workshop_feedback_nag',
      'We\'d Still Love Your Feedback',
      (school) =>
        `Dear ${school.ownerName ?? 'Team'},\n\nWe haven't heard back yet on the feedback form for "${workshop.topic}" — it only takes a minute and helps us improve future sessions. Please share it when you get a chance.\n\nTeam codevidhya`,
    );
    return this.markSent(workshop, sent, 'feedbackNagSentAt');
  }

  // SOP 8.3 "Rescheduling": the school gets the new date by email, and that
  // email stands in for the confirmation. The day-before reminder is cleared
  // so the reminder agent sends a fresh one for the new date.
  async reschedule(schoolId: string, workshopId: string, dto: RescheduleWorkshopDto) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: {
        status: WorkshopStatus.RESCHEDULED,
        scheduledAt: new Date(dto.scheduledAt),
        confirmationSentAt: null,
        reminderSentAt: null,
        // A new date needs a fresh answer from the school.
        schoolConfirmedAt: null,
        changeRequestedAt: null,
        preferredDates: [],
      },
    });
    const sent = await this.notifyForWorkshop(
      workshop.schoolId,
      updated,
      'workshop_rescheduled',
      'Workshop Rescheduled',
      (school) =>
        `Dear ${school.ownerName ?? 'Team'},\n\nThe workshop "${workshop.topic}" originally scheduled for ${formatInZone(workshop.scheduledAt)} has been moved to ${formatInZone(updated.scheduledAt)}${workshop.targetGrades ? ` for grades ${workshop.targetGrades}` : ''}.${dto.reason ? `\n\nReason: ${dto.reason}` : ''}\n\nPlease use the button below to confirm the new date, or to ask for a different one.\n\nTeam codevidhya`,
      true,
    );
    return await this.markSent(updated, sent, 'confirmationSentAt');
  }

  async cancel(schoolId: string, workshopId: string, dto: CancelWorkshopDto) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { status: WorkshopStatus.CANCELLED, cancelReason: dto.cancelReason },
    });
    await this.notifyForWorkshop(workshop.schoolId, updated, 'workshop_cancellation', 'Workshop Cancelled', (school) =>
      `Dear ${school.ownerName ?? 'Team'},\n\nThe workshop "${workshop.topic}" originally scheduled for ${formatInZone(updated.scheduledAt)} has been cancelled: ${dto.cancelReason}.\n\nTeam codevidhya`,
    );
    return updated;
  }

  async recordFeedback(schoolId: string, workshopId: string, dto: RecordFeedbackDto) {
    await this.findOrThrow(schoolId, workshopId);
    return this.prisma.workshop.update({
      where: { id: workshopId },
      data: { feedbackReceivedAt: new Date(), feedbackSummary: dto.feedbackSummary },
    });
  }

  private async findOrThrow(schoolId: string, workshopId: string) {
    const workshop = await this.prisma.workshop.findFirst({ where: { id: workshopId, schoolId } });
    if (!workshop) throw new NotFoundException('Workshop not found');
    return workshop;
  }

  // The *SentAt timestamps drive the UI's "✓ … sent" ticks and the agents'
  // "only while still null" idempotency, so they're only stamped once the
  // email actually went out — a skipped/failed send leaves them null, which
  // shows as not sent and lets the step be retried.
  private async markSent<T extends { id: string }>(
    workshop: T,
    sent: boolean,
    field: 'confirmationSentAt' | 'reminderSentAt' | 'feedbackFormSentAt' | 'feedbackNagSentAt',
  ) {
    if (!sent) return workshop;
    return this.prisma.workshop.update({ where: { id: workshop.id }, data: { [field]: new Date() } });
  }

  private async notifyForWorkshop(
    schoolId: string,
    workshop: { id: string },
    templateKey: string,
    subjectPrefix: string,
    body: (school: { ownerName: string | null; ownerEmail: string | null; name: string }) => string,
    withResponseLink = false,
  ) {
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    return this.notifications.sendTemplateEmail({
      schoolId,
      recipient: school.ownerEmail,
      templateKey,
      subject: `${subjectPrefix} — ${school.name}`,
      // Every workshop email points to the school's calendar, where it sees all its dates and marks holidays.
      body: `${body(school)}\n\nAll your workshop dates, and a place to mark your holidays: ${this.calendarLink(schoolId)}`,
      button: withResponseLink ? { label: 'Confirm or change this date', url: this.responseLink(workshop.id) } : undefined,
    });
  }
}
