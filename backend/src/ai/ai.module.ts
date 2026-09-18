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
import { AgentRunnerService } from './agent-runner.service';
import { AgentSuggestionsService } from './agent-suggestions.service';
import { AgentSuggestionsController } from './agent-suggestions.controller';

@Module({
  imports: [NotificationsModule, EngagementModule, RenewalsModule, WorkshopsModule],
  controllers: [AgentSuggestionsController],
  providers: [
    GeminiService,
    GroqService,
    AiService,
    EngagementAgentService,
    RenewalAgentService,
    WorkshopReminderAgentService,
    RenewalCycleOpenerAgentService,
    AgentRunnerService,
    AgentSuggestionsService,
  ],
})
export class AiModule {}
