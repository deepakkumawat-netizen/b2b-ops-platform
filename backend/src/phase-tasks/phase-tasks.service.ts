import { Injectable, NotFoundException } from '@nestjs/common';
import { PhaseTaskStatus, SchoolLifecyclePhase } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { UpdatePhaseTaskDto } from './dto/update-phase-task.dto';
import { ActivityService } from '../activity/activity.service';

// The one checklist task whose completion triggers the SOP's Phase-2
// "Welcome Email" touchpoint (SOP Step 2.2) — see updateStatus() below.
const WELCOME_EMAIL_TASK_KEY = 'welcome_email';

@Injectable()
export class PhaseTasksService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activity: ActivityService,
  ) {}

  /** Creates one SchoolPhaseTask per seeded PhaseTaskTemplate for a newly
   * created school. Idempotent — safe to call again (e.g. after adding a new
   * template) since it skips rows that already exist. */
  async generateTasksForSchool(schoolId: string): Promise<void> {
    const templates = await this.prisma.phaseTaskTemplate.findMany();
    await this.prisma.schoolPhaseTask.createMany({
      data: templates.map((t) => ({ schoolId, templateId: t.id })),
      skipDuplicates: true,
    });
  }

  async listForSchool(schoolId: string) {
    const tasks = await this.prisma.schoolPhaseTask.findMany({
      where: { schoolId },
      include: { template: true, completedByStaff: { select: { id: true, name: true } } },
    });
    return tasks.sort(
      (a, b) => a.template.sortOrder - b.template.sortOrder || a.template.phase.localeCompare(b.template.phase),
    );
  }

  async updateStatus(schoolId: string, taskId: string, dto: UpdatePhaseTaskDto, staff: StaffJwtPayload) {
    const task = await this.prisma.schoolPhaseTask.findFirst({
      where: { id: taskId, schoolId },
      include: { template: true, school: true },
    });
    if (!task) throw new NotFoundException('Phase task not found');

    const updated = await this.prisma.schoolPhaseTask.update({
      where: { id: taskId },
      data: {
        status: dto.status,
        notes: dto.notes ?? task.notes,
        completedByStaffId: dto.status === PhaseTaskStatus.DONE ? staff.sub : null,
        completedAt: dto.status === PhaseTaskStatus.DONE ? new Date() : null,
      },
      include: { template: true },
    });
    if (dto.status !== task.status) {
      const verb = dto.status === PhaseTaskStatus.DONE ? 'Completed' : dto.status === PhaseTaskStatus.NA ? 'Marked N/A' : 'Reopened';
      await this.activity.record(schoolId, staff, `${verb}: ${task.template.label}`, dto.notes ?? null);
    }

    if (task.template.key === WELCOME_EMAIL_TASK_KEY && dto.status === PhaseTaskStatus.DONE) {
      await this.notifications.sendTemplateEmail({
        schoolId: task.school.id,
        recipient: task.school.ownerEmail,
        templateKey: 'welcome_email',
        subject: `Welcome to CodeVidhya, ${task.school.name}!`,
        body:
          `Dear ${task.school.ownerName ?? 'Team'},\n\n` +
          `Welcome aboard! This confirms our partnership for ${task.school.productProgram ?? 'your program'}. ` +
          `Your account manager will be your point of contact for everything ahead.\n\n` +
          `Looking forward to a great year together.\n\nTeam CodeVidhya`,
      });
    }

    return updated;
  }

  /** Count of PENDING tasks in a given phase — used by SchoolsService to
   * warn (not block) on advancing with incomplete work. */
  async countPendingInPhase(schoolId: string, phase: SchoolLifecyclePhase): Promise<number> {
    return this.prisma.schoolPhaseTask.count({
      where: { schoolId, status: PhaseTaskStatus.PENDING, template: { phase } },
    });
  }
}
