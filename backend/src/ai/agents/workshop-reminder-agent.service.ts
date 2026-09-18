import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, SuggestionType, WorkshopStatus } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkshopsService } from '../../workshops/workshops.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

// Fully autonomous — no draft, no approval. The SOP's "One-Day Reminder"
// step (Phase 8.3) is purely mechanical (a fixed reminder, no relationship
// judgment involved), so this just calls the SAME WorkshopsService.remind()
// a human would click, unmodified, and logs an audit row. Idempotent for
// free: a workshop only matches while reminderSentAt is still null, so a
// re-run within the same day never double-sends.
@Injectable()
export class WorkshopReminderAgentService {
  private readonly logger = new Logger(WorkshopReminderAgentService.name);

  constructor(
    private prisma: PrismaService,
    private workshops: WorkshopsService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(): Promise<number> {
    const tomorrowStart = new Date();
    tomorrowStart.setHours(0, 0, 0, 0);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterStart = new Date(tomorrowStart);
    dayAfterStart.setDate(dayAfterStart.getDate() + 1);

    const dueWorkshops = await this.prisma.workshop.findMany({
      where: {
        status: WorkshopStatus.CONFIRMED,
        reminderSentAt: null,
        scheduledAt: { gte: tomorrowStart, lt: dayAfterStart },
      },
      include: { school: { select: { id: true, name: true } } },
    });

    let sent = 0;
    for (const workshop of dueWorkshops) {
      try {
        await this.workshops.remind(workshop.schoolId, workshop.id);
      } catch (err) {
        this.logger.warn(`Failed to auto-send reminder for workshop ${workshop.id}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      await this.suggestions.logAutoAction({
        schoolId: workshop.schoolId,
        agentKey: AgentKey.WORKSHOP_REMINDER,
        suggestionType: SuggestionType.WORKSHOP_REMINDER_SENT,
        subject: `Reminder auto-sent — ${workshop.topic}`,
        body: `Automatically sent the day-before reminder for "${workshop.topic}" (scheduled ${workshop.scheduledAt.toLocaleString()}) to ${workshop.school.name}.`,
        reasoning: 'Workshop is confirmed and scheduled for tomorrow — the SOP requires a one-day reminder, which is purely mechanical.',
      });
      sent += 1;
    }
    return sent;
  }
}
