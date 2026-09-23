import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

const COMPETITION_FOLLOWUP_DAYS = 14;
const RE_ALERT_SUPPRESS_DAYS = 14;

// Internal-only, log-only alert. SOP Phase 9's "distribute certificates and
// prizes" step has no deadline enforcement today — this flags a school
// with a competition that's still missing certificates or teacher
// certification well after the fact.
//
// Suppression is per-school, not per-competition: one alert covers every
// stale competition a school has in a given window rather than one row
// each. A reasonable simplification for a first pass — revisit if a school
// routinely has several stale competitions at once and staff want them
// itemized.
@Injectable()
export class CompetitionFollowupAgentService {
  private readonly logger = new Logger(CompetitionFollowupAgentService.name);

  constructor(
    private prisma: PrismaService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const cutoff = new Date(Date.now() - COMPETITION_FOLLOWUP_DAYS * 24 * 60 * 60 * 1000);

    const stale = await this.prisma.competitionParticipation.findMany({
      where: {
        date: { lte: cutoff },
        OR: [{ certificatesIssued: false }, { teacherCertified: false }],
      },
      include: { school: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    });

    const bySchool = new Map<string, { name: string; items: typeof stale }>();
    for (const c of stale) {
      const entry = bySchool.get(c.schoolId) ?? { name: c.school.name, items: [] as typeof stale };
      entry.items.push(c);
      bySchool.set(c.schoolId, entry);
    }

    let created = 0;
    for (const [schoolId, { name, items }] of bySchool) {
      const alreadyAlerted = await this.suggestions.hasRecentAutoAction(
        schoolId,
        AgentKey.COMPETITION_FOLLOWUP_ALERT,
        SuggestionType.COMPETITION_FOLLOWUP_NEEDED,
        RE_ALERT_SUPPRESS_DAYS,
      );
      if (alreadyAlerted) continue;

      const names = items.map((c) => c.name).join(', ');
      await this.suggestions.logAutoAction({
        schoolId,
        agentKey: AgentKey.COMPETITION_FOLLOWUP_ALERT,
        suggestionType: SuggestionType.COMPETITION_FOLLOWUP_NEEDED,
        subject: `${items.length} competition(s) missing certificates/prizes — ${name}`,
        body: `${name} has ${items.length} competition(s) still missing certificates or teacher certification more than ${COMPETITION_FOLLOWUP_DAYS} days after the event: ${names}.`,
        reasoning: `certificatesIssued/teacherCertified still false ${COMPETITION_FOLLOWUP_DAYS}+ days after the competition date.`,
      });
      created += 1;
    }
    return created;
  }
}
