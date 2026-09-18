import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EngagementAgentService } from './agents/engagement-agent.service';
import { RenewalAgentService } from './agents/renewal-agent.service';

// Runs every agent's scan. Scheduled daily via @Cron for a normal always-on
// deploy, but ALSO exposed as a plain method the manual "Run agents now"
// endpoint calls directly — Render's free plan sleeps the service after 15
// minutes idle, so the cron alone won't reliably fire there until either the
// plan changes or an external uptime-pinger hits the app periodically.
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private engagementAgent: EngagementAgentService,
    private renewalAgent: RenewalAgentService,
  ) {}

  @Cron('0 8 * * *')
  async runScheduled() {
    await this.runAll();
  }

  async runAll(): Promise<{ engagement: number; renewal: number }> {
    const engagement = await this.engagementAgent.scan();
    const renewal = await this.renewalAgent.scan();
    this.logger.log(`Agent run complete — ${engagement} engagement suggestion(s), ${renewal} renewal suggestion(s)`);
    return { engagement, renewal };
  }
}
