import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkshopStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { CancelWorkshopDto } from './dto/cancel-workshop.dto';
import { RecordFeedbackDto } from './dto/record-feedback.dto';

// Mirrors the SOP Phase 8.3 communication flow exactly: Scheduled →
// Confirmation → One-Day Reminder → Completion/Thank-You + Feedback Form →
// Feedback Follow-up. Each step's email attempt is logged via
// NotificationsService regardless of whether it actually sends.
@Injectable()
export class WorkshopsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  listForSchool(schoolId: string) {
    return this.prisma.workshop.findMany({ where: { schoolId }, orderBy: { scheduledAt: 'asc' } });
  }

  create(schoolId: string, dto: CreateWorkshopDto) {
    return this.prisma.workshop.create({
      data: { schoolId, topic: dto.topic, targetGrades: dto.targetGrades, scheduledAt: new Date(dto.scheduledAt) },
    });
  }

  async update(schoolId: string, workshopId: string, dto: UpdateWorkshopDto) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    return this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { ...dto, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined },
    });
  }

  async confirm(schoolId: string, workshopId: string) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { status: WorkshopStatus.CONFIRMED, confirmationSentAt: new Date() },
    });
    await this.notifyForWorkshop(workshop.schoolId, updated, 'workshop_confirmation', 'Workshop Confirmed', (school) =>
      `Dear ${school.ownerName ?? 'Team'},\n\nThis confirms the workshop "${workshop.topic}" scheduled for ${updated.scheduledAt.toLocaleString()}${workshop.targetGrades ? ` for grades ${workshop.targetGrades}` : ''}.\n\nTeam CodeVidhya`,
    );
    return updated;
  }

  async remind(schoolId: string, workshopId: string) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { reminderSentAt: new Date() },
    });
    await this.notifyForWorkshop(workshop.schoolId, updated, 'workshop_reminder', 'Workshop Reminder — Tomorrow', (school) =>
      `Dear ${school.ownerName ?? 'Team'},\n\nA reminder that the workshop "${workshop.topic}" is scheduled for ${updated.scheduledAt.toLocaleString()}.\n\nTeam CodeVidhya`,
    );
    return updated;
  }

  async complete(schoolId: string, workshopId: string) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const now = new Date();
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { status: WorkshopStatus.COMPLETED, completedAt: now, feedbackFormSentAt: now },
    });
    await this.notifyForWorkshop(
      workshop.schoolId,
      updated,
      'workshop_completion',
      'Thank You — Workshop Completed',
      (school) =>
        `Dear ${school.ownerName ?? 'Team'},\n\nThank you for hosting "${workshop.topic}"! We'd love your feedback — please share it via the feedback form shared alongside this email.\n\nTeam CodeVidhya`,
    );
    return updated;
  }

  async cancel(schoolId: string, workshopId: string, dto: CancelWorkshopDto) {
    const workshop = await this.findOrThrow(schoolId, workshopId);
    const updated = await this.prisma.workshop.update({
      where: { id: workshop.id },
      data: { status: WorkshopStatus.CANCELLED, cancelReason: dto.cancelReason },
    });
    await this.notifyForWorkshop(workshop.schoolId, updated, 'workshop_cancellation', 'Workshop Cancelled', (school) =>
      `Dear ${school.ownerName ?? 'Team'},\n\nThe workshop "${workshop.topic}" originally scheduled for ${updated.scheduledAt.toLocaleString()} has been cancelled: ${dto.cancelReason}.\n\nTeam CodeVidhya`,
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

  private async notifyForWorkshop(
    schoolId: string,
    workshop: { id: string },
    templateKey: string,
    subjectPrefix: string,
    body: (school: { ownerName: string | null; ownerEmail: string | null; name: string }) => string,
  ) {
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    await this.notifications.sendTemplateEmail({
      schoolId,
      recipient: school.ownerEmail,
      templateKey,
      subject: `${subjectPrefix} — ${school.name}`,
      body: body(school),
    });
  }
}
