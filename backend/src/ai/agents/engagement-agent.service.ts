import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SchoolStatus, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EngagementService } from '../../engagement/engagement.service';
import { AiService } from '../ai.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

// Watches for schools overdue on the SOP's monthly-visit/weekly-call cadence
// (SOP Phase 8.1/8.2) and drafts a check-in nudge — the most repetitive
// manual follow-up work in the whole lifecycle.
@Injectable()
export class EngagementAgentService {
  private readonly logger = new Logger(EngagementAgentService.name);

  constructor(
    private prisma: PrismaService,
    private engagement: EngagementService,
    private ai: AiService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const schools = await this.prisma.school.findMany({
      where: { status: SchoolStatus.ACTIVE },
      select: { id: true, name: true, currentPhase: true, ownerName: true },
    });
    const overdue = await this.engagement.getOverdueStatusForSchools(schools.map((s) => s.id));

    let created = 0;
    for (const school of schools) {
      const status = overdue.get(school.id);
      if (!status?.visitOverdue && !status?.callOverdue) continue;

      const prompt = this.buildPrompt(school, status);
      const draft = await this.ai.draftSuggestion(prompt);
      if (!draft) {
        this.logger.warn(`No draft produced for ${school.name} (AI unconfigured or failed)`);
        continue;
      }
      const suggestion = await this.suggestions.createIfNotDuplicate({
        schoolId: school.id,
        agentKey: AgentKey.ENGAGEMENT,
        suggestionType: SuggestionType.FOLLOWUP_EMAIL,
        draft,
      });
      if (suggestion) created += 1;
    }
    return created;
  }

  private buildPrompt(
    school: { name: string; currentPhase: string; ownerName: string | null },
    status: { lastVisitDate: Date | null; visitOverdue: boolean; lastCallDate: Date | null; callOverdue: boolean },
  ): string {
    const gaps: string[] = [];
    if (status.visitOverdue) {
      gaps.push(status.lastVisitDate ? `no monthly on-site visit since ${status.lastVisitDate.toDateString()}` : 'no monthly on-site visit has ever been logged');
    }
    if (status.callOverdue) {
      gaps.push(status.lastCallDate ? `no weekly check-in call since ${status.lastCallDate.toDateString()}` : 'no weekly check-in call has ever been logged');
    }
    return (
      `You are drafting a short, warm check-in email from a CodeVidhya Account Manager to a partner school, ` +
      `"${school.name}" (contact: ${school.ownerName ?? 'the school owner/coordinator'}), currently in the ` +
      `"${school.currentPhase.replace(/_/g, ' ')}" phase of onboarding. The account has fallen behind on our ` +
      `own engagement cadence: ${gaps.join(' and ')}. Draft a brief, friendly email proposing a quick call or ` +
      `visit to check in, without sounding like an apology or admitting internal process failure.`
    );
  }
}
