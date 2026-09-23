import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SchoolLifecyclePhase, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

const RE_ALERT_SUPPRESS_DAYS = 14;
const REQUIRED_FIELDS = ['ownerName', 'ownerEmail', 'ownerPhone', 'productProgram'] as const;

// Internal-only, log-only alert. Actively enforces the SOP's own key note
// ("no onboarding activity should start without complete handover data")
// instead of just hoping Sales filled everything in — flags any school
// that has moved past the handover phase while still missing a core field.
@Injectable()
export class DataCompletenessAgentService {
  private readonly logger = new Logger(DataCompletenessAgentService.name);

  constructor(
    private prisma: PrismaService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const schools = await this.prisma.school.findMany({
      where: { currentPhase: { not: SchoolLifecyclePhase.SALES_HANDOVER } },
      select: { id: true, name: true, ownerName: true, ownerEmail: true, ownerPhone: true, productProgram: true },
    });

    let created = 0;
    for (const school of schools) {
      const missing = REQUIRED_FIELDS.filter((field) => !school[field]);
      if (missing.length === 0) continue;

      const alreadyAlerted = await this.suggestions.hasRecentAutoAction(
        school.id,
        AgentKey.DATA_COMPLETENESS_ALERT,
        SuggestionType.MISSING_HANDOVER_DATA,
        RE_ALERT_SUPPRESS_DAYS,
      );
      if (alreadyAlerted) continue;

      await this.suggestions.logAutoAction({
        schoolId: school.id,
        agentKey: AgentKey.DATA_COMPLETENESS_ALERT,
        suggestionType: SuggestionType.MISSING_HANDOVER_DATA,
        subject: `Missing handover data — ${school.name}`,
        body: `${school.name} is past the Sales Handover phase but is still missing: ${missing.join(', ')}. Per the SOP, onboarding shouldn't proceed without complete handover data.`,
        reasoning: `School has advanced past SALES_HANDOVER while missing required field(s): ${missing.join(', ')}.`,
      });
      created += 1;
    }
    return created;
  }
}
