import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, RenewalStatus, SchoolLifecyclePhase, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RenewalsService } from '../../renewals/renewals.service';
import { AiService } from '../ai.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

// Compiles the SOP's required "summary of the year's activities" (Phase 10
// key note) and drafts a renewal pitch for any school that's either reached
// the Annual Renewal phase or already has an open (non-terminal) renewal
// cycle — the second most repetitive manual write-up in the lifecycle.
@Injectable()
export class RenewalAgentService {
  private readonly logger = new Logger(RenewalAgentService.name);

  constructor(
    private prisma: PrismaService,
    private renewals: RenewalsService,
    private ai: AiService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const candidateSchools = await this.prisma.school.findMany({
      where: {
        OR: [
          { currentPhase: SchoolLifecyclePhase.ANNUAL_RENEWAL },
          { renewalCycles: { some: { renewalStatus: { in: [RenewalStatus.PENDING, RenewalStatus.APPROACHED] } } } },
        ],
      },
      select: { id: true, name: true, ownerName: true },
    });

    let created = 0;
    for (const school of candidateSchools) {
      const summary = await this.renewals.getYearSummary(school.id);
      const prompt = this.buildPrompt(school, summary);
      const draft = await this.ai.draftSuggestion(prompt);
      if (!draft) {
        this.logger.warn(`No draft produced for ${school.name} (AI unconfigured or failed)`);
        continue;
      }
      const suggestion = await this.suggestions.createIfNotDuplicate({
        schoolId: school.id,
        agentKey: AgentKey.RENEWAL,
        suggestionType: SuggestionType.RENEWAL_PITCH,
        draft,
      });
      if (suggestion) created += 1;
    }
    return created;
  }

  private buildPrompt(
    school: { name: string; ownerName: string | null },
    summary: {
      workshopsCompleted: number;
      workshopsTotal: number;
      competitionsCount: number;
      certificatesIssuedCount: number;
      monthlyVisitsCount: number;
      weeklyCallsCount: number;
    },
  ): string {
    return (
      `You are drafting a renewal-pitch email from CodeVidhya to a partner school, "${school.name}" ` +
      `(contact: ${school.ownerName ?? 'the school owner/decision-maker'}), for the next academic year. ` +
      `Ground the pitch in this year's actual delivery record, cited specifically: ` +
      `${summary.workshopsCompleted} of ${summary.workshopsTotal} scheduled student workshops completed, ` +
      `${summary.competitionsCount} competitions run (${summary.certificatesIssuedCount} with certificates issued), ` +
      `${summary.monthlyVisitsCount} on-site visits and ${summary.weeklyCallsCount} check-in calls conducted. ` +
      `Warmly propose continuing the partnership for another year, backed by this track record, and suggest a call ` +
      `to finalize renewal terms.`
    );
  }
}
