import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SuggestionType, WorkshopStatus } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkshopsService } from '../../workshops/workshops.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

const FEEDBACK_NAG_DAYS = 5;

// Fully autonomous and school-facing, like WorkshopReminderAgentService —
// the SOP's own Feedback Collection step says to "follow up with the
// school if feedback has not been received within the expected timeline."
// Idempotent for free: a workshop only matches while feedbackNagSentAt is
// still null, same trick reminderSentAt already uses.
@Injectable()
export class WorkshopFeedbackNagAgentService {
  private readonly logger = new Logger(WorkshopFeedbackNagAgentService.name);

  constructor(
    private prisma: PrismaService,
    private workshops: WorkshopsService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const cutoff = new Date(Date.now() - FEEDBACK_NAG_DAYS * 24 * 60 * 60 * 1000);

    const dueWorkshops = await this.prisma.workshop.findMany({
      where: {
        status: WorkshopStatus.COMPLETED,
        feedbackReceivedAt: null,
        feedbackNagSentAt: null,
        feedbackFormSentAt: { not: null, lte: cutoff },
      },
      include: { school: { select: { id: true, name: true } } },
    });

    let sent = 0;
    for (const workshop of dueWorkshops) {
      try {
        await this.workshops.nagFeedback(workshop.schoolId, workshop.id);
      } catch (err) {
        this.logger.warn(`Failed to auto-send feedback nag for workshop ${workshop.id}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      await this.suggestions.logAutoAction({
        schoolId: workshop.schoolId,
        agentKey: AgentKey.WORKSHOP_FEEDBACK_NAG,
        suggestionType: SuggestionType.WORKSHOP_FEEDBACK_NAG_SENT,
        subject: `Feedback nag auto-sent — ${workshop.topic}`,
        body: `Automatically sent a feedback follow-up for "${workshop.topic}" (completed, feedback form sent ${FEEDBACK_NAG_DAYS}+ days ago with no response) to ${workshop.school.name}.`,
        reasoning: `No feedback received ${FEEDBACK_NAG_DAYS}+ days after the form was sent — the SOP requires a follow-up, which is purely mechanical.`,
      });
      sent += 1;
    }
    return sent;
  }
}
