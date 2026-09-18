import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkshopStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRenewalCycleDto } from './dto/create-renewal-cycle.dto';
import { UpdateRenewalCycleDto } from './dto/update-renewal-cycle.dto';

@Injectable()
export class RenewalsService {
  constructor(private prisma: PrismaService) {}

  listForSchool(schoolId: string) {
    return this.prisma.renewalCycle.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' } });
  }

  create(schoolId: string, dto: CreateRenewalCycleDto) {
    return this.prisma.renewalCycle.create({ data: { ...dto, schoolId } });
  }

  async update(schoolId: string, cycleId: string, dto: UpdateRenewalCycleDto) {
    const cycle = await this.prisma.renewalCycle.findFirst({ where: { id: cycleId, schoolId } });
    if (!cycle) throw new NotFoundException('Renewal cycle not found');
    return this.prisma.renewalCycle.update({
      where: { id: cycleId },
      data: {
        ...dto,
        feedbackCallDate: dto.feedbackCallDate ? new Date(dto.feedbackCallDate) : undefined,
        agreementSignedAt: dto.agreementSignedAt ? new Date(dto.agreementSignedAt) : undefined,
      },
    });
  }

  /** The "summary of the year's activities" the SOP requires for a renewal
   * conversation (SOP key notes, Phase 10) — compiled on read from
   * Workshop/CompetitionParticipation/EngagementLog rather than stored
   * redundantly. Spans the whole partnership to date (v1 doesn't yet scope
   * this to a single academic-year date range). */
  async getYearSummary(schoolId: string) {
    const [workshops, competitions, engagementLogs] = await Promise.all([
      this.prisma.workshop.findMany({ where: { schoolId } }),
      this.prisma.competitionParticipation.findMany({ where: { schoolId } }),
      this.prisma.engagementLog.findMany({ where: { schoolId } }),
    ]);
    return {
      workshopsCompleted: workshops.filter((w) => w.status === WorkshopStatus.COMPLETED).length,
      workshopsTotal: workshops.length,
      competitionsCount: competitions.length,
      certificatesIssuedCount: competitions.filter((c) => c.certificatesIssued).length,
      monthlyVisitsCount: engagementLogs.filter((l) => l.type === 'MONTHLY_VISIT').length,
      weeklyCallsCount: engagementLogs.filter((l) => l.type === 'WEEKLY_CALL').length,
    };
  }
}
