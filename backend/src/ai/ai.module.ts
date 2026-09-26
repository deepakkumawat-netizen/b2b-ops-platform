import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EngagementModule } from '../engagement/engagement.module';
import { RenewalsModule } from '../renewals/renewals.module';
import { WorkshopsModule } from '../workshops/workshops.module';
import { GeminiService } from './gemini.service';
import { GroqService } from './groq.service';
import { AiService } from './ai.service';
import { EngagementAgentService } from './agents/engagement-agent.service';
import { RenewalAgentService } from './agents/renewal-agent.service';
import { WorkshopReminderAgentService } from './agents/workshop-reminder-agent.service';
import { RenewalCycleOpenerAgentService } from './agents/renewal-cycle-opener-agent.service';
import { WorkshopFeedbackNagAgentService } from './agents/workshop-feedback-nag-agent.service';
import { StalePhaseAgentService } from './agents/stale-phase-agent.service';
import { RenewalStalledAgentService } from './agents/renewal-stalled-agent.service';
import { CompetitionFollowupAgentService } from './agents/competition-followup-agent.service';
import { DataCompletenessAgentService } from './agents/data-completeness-agent.service';
import { AgentRunnerService } from './agent-runner.service';
import { AgentSuggestionsService } from './agent-suggestions.service';
import { AgentSuggestionsController } from './agent-suggestions.controller';
import { CronController } from './cron.controller';

@Module({
  imports: [NotificationsModule, EngagementModule, RenewalsModule, WorkshopsModule],
  controllers: [AgentSuggestionsController, CronController],
  providers: [
    GeminiService,
    GroqService,
    AiService,
    EngagementAgentService,
    RenewalAgentService,
    WorkshopReminderAgentService,
    RenewalCycleOpenerAgentService,
    WorkshopFeedbackNagAgentService,
    StalePhaseAgentService,
    RenewalStalledAgentService,
    CompetitionFollowupAgentService,
    DataCompletenessAgentService,
    AgentRunnerService,
    AgentSuggestionsService,
  ],
})
export class AiModule {}
