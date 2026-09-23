import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, RenewalStatus, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

const RENEWAL_STALLED_DAYS = 14;
const RE_ALERT_SUPPRESS_DAYS = 14;

// Internal-only, log-only alert. A renewal cycle sitting in APPROACHED
// (Sales has reached out, no decision yet) for too long is worth a nudge —
// see AgentSuggestionsService.hasRecentAutoAction for why this needs a
// suppression window rather than a null-field check.
@Injectable()
export class RenewalStalledAgentService {
  private readonly logger = new Logger(RenewalStalledAgentService.name);

  constructor(
    private prisma: PrismaService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const cutoff = new Date(Date.now() - RENEWAL_STALLED_DAYS * 24 * 60 * 60 * 1000);

    const stalledCycles = await this.prisma.renewalCycle.findMany({
      where: { renewalStatus: RenewalStatus.APPROACHED, updatedAt: { lte: cutoff } },
      include: { school: { select: { id: true, name: true } } },
    });

    let created = 0;
    for (const cycle of stalledCycles) {
      const alreadyAlerted = await this.suggestions.hasRecentAutoAction(
        cycle.schoolId,
        AgentKey.RENEWAL_STALLED_ALERT,
        SuggestionType.RENEWAL_STALLED,
        RE_ALERT_SUPPRESS_DAYS,
      );
      if (alreadyAlerted) continue;

      const days = Math.floor((Date.now() - cycle.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
      await this.suggestions.logAutoAction({
        schoolId: cycle.schoolId,
        agentKey: AgentKey.RENEWAL_STALLED_ALERT,
        suggestionType: SuggestionType.RENEWAL_STALLED,
        subject: `Renewal stalled ${days} days — ${cycle.school.name}`,
        body: `The "${cycle.cycleLabel}" renewal cycle for ${cycle.school.name} has been in Approached status for ${days} days with no update. Worth following up before it goes cold.`,
        reasoning: `RenewalCycle stuck in APPROACHED for ${RENEWAL_STALLED_DAYS}+ days — a pure staleness check, no judgment involved.`,
      });
      created += 1;
    }
    return created;
  }
}
