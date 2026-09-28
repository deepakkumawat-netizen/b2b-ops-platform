import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SCHOOL_LIFECYCLE_PHASE_LABELS, SCHOOL_LIFECYCLE_PHASE_ORDER, SchoolLifecyclePhase, StaffRole } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PhaseTasksService } from '../phase-tasks/phase-tasks.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { schoolScopeWhere, assertSchoolAccess } from '../common/scope';
import { ActivityService } from '../activity/activity.service';
import { SchoolAutomationService } from '../automation/school-automation.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    private prisma: PrismaService,
    private phaseTasks: PhaseTasksService,
    private activity: ActivityService,
    private automation: SchoolAutomationService,
  ) {}

  async create(dto: CreateSchoolDto, staff: StaffJwtPayload) {
    await this.assertAssignableAccountManager(dto.assignedAccountManagerId);
    const school = await this.prisma.school.create({
      data: { ...dto, currentPhase: SchoolLifecyclePhase.SALES_HANDOVER },
    });
    await this.phaseTasks.generateTasksForSchool(school.id);
    await this.activity.record(school.id, staff, 'School created', 'Sales handover recorded');
    // Welcome email to the school, enrollment alert to admins, then tick
    // whatever the handover form already proves (and advance past it).
    await this.automation.onSchoolCreated(school.id, staff);
    return (await this.prisma.school.findUnique({ where: { id: school.id } })) ?? school;
  }

  async findAll(staff: StaffJwtPayload) {
    return this.prisma.school.findMany({
      where: schoolScopeWhere(staff),
      include: {
        assignedAccountManager: { select: { id: true, name: true } },
        assignedSalesRep: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, staff: StaffJwtPayload) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        assignedAccountManager: { select: { id: true, name: true } },
        assignedSalesRep: { select: { id: true, name: true } },
        teachers: true,
        infraDiagnostic: true,
      },
    });
    if (!school) throw new NotFoundException('School not found');
    assertSchoolAccess(staff, school);
    return school;
  }

  async update(id: string, dto: UpdateSchoolDto, staff: StaffJwtPayload) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');
    assertSchoolAccess(staff, school);
    const reassigning =
      dto.assignedAccountManagerId !== undefined && (dto.assignedAccountManagerId ?? null) !== school.assignedAccountManagerId;
    if (reassigning) {
      // An account manager only sees their own schools, so letting them
      // reassign one would just make it vanish from their list.
      if (staff.role === StaffRole.ACCOUNT_MANAGER) {
        throw new ForbiddenException('Only Sales, Operations or a Super Admin can change the account manager');
      }
      await this.assertAssignableAccountManager(dto.assignedAccountManagerId);
    }
    const updated = await this.prisma.school.update({ where: { id }, data: dto });
    const changed = (Object.keys(dto) as (keyof UpdateSchoolDto)[]).filter(
      (key) => dto[key] !== undefined && String(dto[key] ?? '') !== String(school[key as keyof typeof school] ?? ''),
    );
    if (changed.length > 0) {
      const labels = changed.map((key) => (key === 'assignedAccountManagerId' ? 'account manager' : key));
      await this.activity.record(id, staff, 'School details updated', `Changed: ${labels.join(', ')}`);
    }
    // The handover form had no owner email, so the welcome email never went
    // out — send it now that there's somewhere to send it.
    if (!school.ownerEmail && updated.ownerEmail) {
      await this.automation.onOwnerEmailAdded(id);
    }
    return updated;
  }

  // Without this a typo'd or stale id surfaces as a raw foreign-key 500, and
  // any staff id (e.g. a Sales rep) could be set as the "account manager".
  private async assertAssignableAccountManager(staffId: string | null | undefined) {
    if (!staffId) return;
    const manager = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!manager || !manager.isActive || manager.role !== StaffRole.ACCOUNT_MANAGER) {
      throw new BadRequestException('Account manager must be an active Account Manager');
    }
  }

  /** Advances a school to the immediate next SOP phase only — the ordered
   * list makes skipping ahead structurally impossible, matching the SOP's
   * "no step skipped or reordered" rule. Incomplete tasks in the current
   * phase produce a warning in the response, not a hard block, since some
   * tasks may legitimately not apply to every school. */
  async advancePhase(id: string, staff: StaffJwtPayload) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');
    assertSchoolAccess(staff, school);

    const currentIndex = SCHOOL_LIFECYCLE_PHASE_ORDER.indexOf(school.currentPhase);
    if (currentIndex === SCHOOL_LIFECYCLE_PHASE_ORDER.length - 1) {
      throw new BadRequestException('School is already at the final phase (Annual Renewal)');
    }
    const pendingCount = await this.phaseTasks.countPendingInPhase(id, school.currentPhase);
    const nextPhase = SCHOOL_LIFECYCLE_PHASE_ORDER[currentIndex + 1];
    const updated = await this.prisma.school.update({ where: { id }, data: { currentPhase: nextPhase } });
    await this.activity.record(
      id,
      staff,
      `Advanced to ${SCHOOL_LIFECYCLE_PHASE_LABELS[nextPhase]}`,
      pendingCount > 0 ? `${pendingCount} task(s) in ${SCHOOL_LIFECYCLE_PHASE_LABELS[school.currentPhase]} left incomplete` : null,
    );
    return {
      school: updated,
      warning: pendingCount > 0 ? `${pendingCount} task(s) in the previous phase were left incomplete` : null,
    };
  }
}
