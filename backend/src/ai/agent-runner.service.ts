import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EngagementAgentService } from './agents/engagement-agent.service';
import { RenewalAgentService } from './agents/renewal-agent.service';
import { WorkshopReminderAgentService } from './agents/workshop-reminder-agent.service';
import { RenewalCycleOpenerAgentService } from './agents/renewal-cycle-opener-agent.service';
import { WorkshopFeedbackNagAgentService } from './agents/workshop-feedback-nag-agent.service';
import { StalePhaseAgentService } from './agents/stale-phase-agent.service';
import { RenewalStalledAgentService } from './agents/renewal-stalled-agent.service';
import { CompetitionFollowupAgentService } from './agents/competition-followup-agent.service';
import { DataCompletenessAgentService } from './agents/data-completeness-agent.service';

// Runs every agent's scan. Scheduled daily via @Cron for a normal always-on
// deploy, but ALSO exposed as a plain method the manual "Run agents now"
// endpoint calls directly — Render's free plan sleeps the service after 15
// minutes idle, so the cron alone won't reliably fire there until either the
// plan changes or an external uptime-pinger hits the app periodically.
//
// Two agents (engagement, renewal) draft content a human approves. The rest
// act fully autonomously — one (workshopFeedbackNag) is school-facing like
// workshopReminder/renewalCycleOpener; four more (stalePhase, renewalStalled,
// competitionFollowup, dataCompleteness) are internal-only alerts that log an
// audit row but never email anyone — see each agent's own file.
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private engagementAgent: EngagementAgentService,
    private renewalAgent: RenewalAgentService,
    private workshopReminderAgent: WorkshopReminderAgentService,
    private renewalCycleOpenerAgent: RenewalCycleOpenerAgentService,
    private workshopFeedbackNagAgent: WorkshopFeedbackNagAgentService,
    private stalePhaseAgent: StalePhaseAgentService,
    private renewalStalledAgent: RenewalStalledAgentService,
    private competitionFollowupAgent: CompetitionFollowupAgentService,
    private dataCompletenessAgent: DataCompletenessAgentService,
  ) {}

  @Cron('0 8 * * *')
  async runScheduled() {
    await this.runAll();
  }

  async runAll(): Promise<{
    engagement: number;
    renewal: number;
    workshopReminder: number;
    renewalCycleOpener: number;
    workshopFeedbackNag: number;
    stalePhase: number;
    renewalStalled: number;
    competitionFollowup: number;
    dataCompleteness: number;
  }> {
    const engagement = await this.engagementAgent.scan();
    const renewal = await this.renewalAgent.scan();
    const workshopReminder = await this.workshopReminderAgent.scan();
    const renewalCycleOpener = await this.renewalCycleOpenerAgent.scan();
    const workshopFeedbackNag = await this.workshopFeedbackNagAgent.scan();
    const stalePhase = await this.stalePhaseAgent.scan();
    const renewalStalled = await this.renewalStalledAgent.scan();
    const competitionFollowup = await this.competitionFollowupAgent.scan();
    const dataCompleteness = await this.dataCompletenessAgent.scan();
    this.logger.log(
      `Agent run complete — ${engagement} engagement suggestion(s), ${renewal} renewal suggestion(s), ` +
        `${workshopReminder} workshop reminder(s) auto-sent, ${renewalCycleOpener} renewal cycle(s) auto-opened, ` +
        `${workshopFeedbackNag} feedback nag(s) auto-sent, ${stalePhase} stale-phase alert(s), ` +
        `${renewalStalled} stalled-renewal alert(s), ${competitionFollowup} competition-followup alert(s), ` +
        `${dataCompleteness} data-completeness alert(s)`,
    );
    return {
      engagement,
      renewal,
      workshopReminder,
      renewalCycleOpener,
      workshopFeedbackNag,
      stalePhase,
      renewalStalled,
      competitionFollowup,
      dataCompleteness,
    };
  }
}
