import { Injectable } from '@nestjs/common';
import { EngagementType } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEngagementLogDto } from './dto/create-engagement-log.dto';

// SOP Phase 8.1/8.2 cadence: at least one monthly visit, one weekly call.
// These thresholds back the dashboard's "overdue" flag.
const VISIT_OVERDUE_DAYS = 35;
const CALL_OVERDUE_DAYS = 10;

@Injectable()
export class EngagementService {
  constructor(private prisma: PrismaService) {}

  listForSchool(schoolId: string) {
    return this.prisma.engagementLog.findMany({
      where: { schoolId },
      include: { conductedByStaff: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
  }

  create(schoolId: string, dto: CreateEngagementLogDto, conductedByStaffId: string) {
    return this.prisma.engagementLog.create({
      data: { ...dto, date: new Date(dto.date), schoolId, conductedByStaffId },
    });
  }

  /** Last visit/call date per school + whether each is overdue against the
   * SOP cadence — computed on read rather than stored, since it's a
   * function of "now" and the log history, never independently true. */
  async getOverdueStatusForSchools(schoolIds: string[]) {
    const logs = await this.prisma.engagementLog.findMany({
      where: { schoolId: { in: schoolIds } },
      orderBy: { date: 'desc' },
    });
    const now = Date.now();
    const result = new Map<
      string,
      { lastVisitDate: Date | null; visitOverdue: boolean; lastCallDate: Date | null; callOverdue: boolean }
    >();
    for (const schoolId of schoolIds) {
      const schoolLogs = logs.filter((l) => l.schoolId === schoolId);
      const lastVisit = schoolLogs.find((l) => l.type === EngagementType.MONTHLY_VISIT) ?? null;
      const lastCall = schoolLogs.find((l) => l.type === EngagementType.WEEKLY_CALL) ?? null;
      result.set(schoolId, {
        lastVisitDate: lastVisit?.date ?? null,
        visitOverdue: this.isOverdue(lastVisit?.date, now, VISIT_OVERDUE_DAYS),
        lastCallDate: lastCall?.date ?? null,
        callOverdue: this.isOverdue(lastCall?.date, now, CALL_OVERDUE_DAYS),
      });
    }
    return result;
  }

  private isOverdue(lastDate: Date | undefined, now: number, thresholdDays: number): boolean {
    if (!lastDate) return true;
    const daysSince = (now - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > thresholdDays;
  }
}
