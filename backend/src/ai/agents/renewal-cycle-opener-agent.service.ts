import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SchoolLifecyclePhase, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RenewalsService } from '../../renewals/renewals.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

// Fully autonomous — opening the record is a pure administrative step, not
// a judgment call (the human still fills in the feedback call date and
// renewal status themselves). Idempotent by construction: the scan
// condition IS "has no renewal cycle yet", so a school only ever matches
// once, no separate de-dup check needed.
function defaultCycleLabel(now: Date): string {
  const year = now.getFullYear();
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

@Injectable()
export class RenewalCycleOpenerAgentService {
  private readonly logger = new Logger(RenewalCycleOpenerAgentService.name);

  constructor(
    private prisma: PrismaService,
    private renewals: RenewalsService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const schools = await this.prisma.school.findMany({
      where: { currentPhase: SchoolLifecyclePhase.ANNUAL_RENEWAL, renewalCycles: { none: {} } },
      select: { id: true, name: true },
    });

    const cycleLabel = defaultCycleLabel(new Date());
    let opened = 0;
    for (const school of schools) {
      try {
        await this.renewals.create(school.id, { cycleLabel });
      } catch (err) {
        this.logger.warn(`Failed to auto-open renewal cycle for ${school.name}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      await this.suggestions.logAutoAction({
        schoolId: school.id,
        agentKey: AgentKey.RENEWAL_CYCLE_OPENER,
        suggestionType: SuggestionType.RENEWAL_CYCLE_OPENED,
        subject: `Renewal cycle "${cycleLabel}" opened — ${school.name}`,
        body: `${school.name} reached the Annual Renewal phase, so a "${cycleLabel}" renewal cycle was automatically opened. Fill in the feedback call date and renewal status when ready.`,
        reasoning: 'School entered ANNUAL_RENEWAL with no existing renewal cycle — opening the record is administrative, not a judgment call.',
      });
      opened += 1;
    }
    return opened;
  }
}
