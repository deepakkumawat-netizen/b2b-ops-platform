import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SCHOOL_LIFECYCLE_PHASE_ORDER, SchoolLifecyclePhase } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PhaseTasksService } from '../phase-tasks/phase-tasks.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { schoolScopeWhere, assertSchoolAccess } from '../common/scope';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    private prisma: PrismaService,
    private phaseTasks: PhaseTasksService,
  ) {}

  async create(dto: CreateSchoolDto) {
    const school = await this.prisma.school.create({
      data: { ...dto, currentPhase: SchoolLifecyclePhase.SALES_HANDOVER },
    });
    await this.phaseTasks.generateTasksForSchool(school.id);
    return school;
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
    return this.prisma.school.update({ where: { id }, data: dto });
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
    return {
      school: updated,
      warning: pendingCount > 0 ? `${pendingCount} task(s) in the previous phase were left incomplete` : null,
    };
  }
}
