import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SchoolLifecyclePhase, SchoolStatus, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

const STALE_PHASE_DAYS = 30;
const RE_ALERT_SUPPRESS_DAYS = 14;

// Internal-only, log-only alert (no established staff-notification
// recipient policy yet — see AgentSuggestionsService.hasRecentAutoAction).
// Flags an ACTIVE school with no checklist progress in STALE_PHASE_DAYS —
// "last activity" is the newer of the school's own creation date and its
// most recent completed phase task, so a brand-new school isn't flagged on
// day one.
@Injectable()
export class StalePhaseAgentService {
  private readonly logger = new Logger(StalePhaseAgentService.name);

  constructor(
    private prisma: PrismaService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_PHASE_DAYS * 24 * 60 * 60 * 1000);

    const schools = await this.prisma.school.findMany({
      where: { status: SchoolStatus.ACTIVE, currentPhase: { not: SchoolLifecyclePhase.ANNUAL_RENEWAL } },
      select: { id: true, name: true, currentPhase: true, createdAt: true },
    });

    // One grouped query for every school's most recent completed task,
    // rather than N+1 lookups or relying on Prisma's nested orderBy+take
    // (which would need an explicit `completedAt: { not: null }` filter to
    // avoid NULLS FIRST on a DESC order surfacing a still-pending task).
    const lastCompletions = await this.prisma.schoolPhaseTask.groupBy({
      by: ['schoolId'],
      where: { schoolId: { in: schools.map((s) => s.id) }, completedAt: { not: null } },
      _max: { completedAt: true },
    });
    const lastCompletionBySchool = new Map(lastCompletions.map((c) => [c.schoolId, c._max.completedAt as Date]));

    let created = 0;
    for (const school of schools) {
      const lastActivity = lastCompletionBySchool.get(school.id) ?? school.createdAt;
      if (lastActivity > cutoff) continue;

      const alreadyAlerted = await this.suggestions.hasRecentAutoAction(
        school.id,
        AgentKey.STALE_PHASE_ALERT,
        SuggestionType.STALE_PHASE_DETECTED,
        RE_ALERT_SUPPRESS_DAYS,
      );
      if (alreadyAlerted) continue;

      const days = Math.floor((Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000));
      await this.suggestions.logAutoAction({
        schoolId: school.id,
        agentKey: AgentKey.STALE_PHASE_ALERT,
        suggestionType: SuggestionType.STALE_PHASE_DETECTED,
        subject: `No checklist progress in ${days} days — ${school.name}`,
        body: `${school.name} has had no checklist task completed in ${days} days and is still in the "${school.currentPhase.replace(/_/g, ' ')}" phase. Worth a check-in on what's blocking progress.`,
        reasoning: `No SchoolPhaseTask completed in ${STALE_PHASE_DAYS}+ days while the school is still active and short of Annual Renewal.`,
      });
      created += 1;
    }
    return created;
  }
}
