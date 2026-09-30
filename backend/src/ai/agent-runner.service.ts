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
import { SchoolDetailsReminderAgentService } from './agents/school-details-reminder-agent.service';
import { WorkshopReschedulerAgentService } from './agents/workshop-rescheduler-agent.service';
import { WorkshopSchedulerAgentService } from './agents/workshop-scheduler-agent.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { SchoolAutomationService } from '../automation/school-automation.service';
import { APP_TIMEZONE } from '../common/time';

export const AGENT_NAMES = [
  // First, so later agents (e.g. stalePhase) see the phases it advanced.
  'checklist',
  // Right after, so a school the checklist agent just moved into ongoing
  // engagement gets its workshops the same morning.
  'workshopScheduler',
  'engagement',
  'renewal',
  'workshopReminder',
  'renewalCycleOpener',
  'workshopFeedbackNag',
  'stalePhase',
  'renewalStalled',
  'competitionFollowup',
  'dataCompleteness',
  'schoolDetailsReminder',
  'workshopRescheduler',
  // Last, so Google Calendar gets every change the agents above made.
  'googleCalendar',
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];
export type AgentRunResult = Record<AgentName, number> & { errors: Partial<Record<AgentName, string>> };

// Runs every agent's scan. Scheduled daily via @Cron for a normal always-on
// deploy, but ALSO exposed as a plain method the manual "Run agents now"
// endpoint calls directly — Render's free plan sleeps the service after 15
// minutes idle, so the cron alone won't reliably fire there. The GitHub
// Actions schedule in .github/workflows/daily-agents.yml covers that by
// calling CronController's secret-protected endpoint every morning.
//
// The checklist agent (SchoolAutomationService) ticks tasks the data proves
// and advances phases — a safety net for its per-request sync; it never
// emails. Two agents (engagement, renewal) draft content a human approves. The rest
// act fully autonomously — four (workshopFeedbackNag, schoolDetailsReminder, workshopRescheduler, workshopScheduler) are school-facing like
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
    private schoolDetailsReminderAgent: SchoolDetailsReminderAgentService,
    private workshopReschedulerAgent: WorkshopReschedulerAgentService,
    private workshopSchedulerAgent: WorkshopSchedulerAgentService,
    private googleCalendar: GoogleCalendarService,
    private checklistAgent: SchoolAutomationService,
  ) {}

  // 8 AM in the business timezone — without timeZone, @Cron uses the
  // server's clock (UTC on Render), which is 1:30 PM IST.
  @Cron('0 8 * * *', { timeZone: APP_TIMEZONE })
  async runScheduled() {
    await this.runAll();
  }

  /** Runs every agent even if an earlier one throws (a DB hiccup or AI
   * timeout in one agent must not silently skip the rest for the day).
   * Failed agents report 0 and their error message under `errors`. */
  async runAll(): Promise<AgentRunResult> {
    const agents: Record<AgentName, { scan(): Promise<number> }> = {
      checklist: this.checklistAgent,
      engagement: this.engagementAgent,
      renewal: this.renewalAgent,
      workshopReminder: this.workshopReminderAgent,
      renewalCycleOpener: this.renewalCycleOpenerAgent,
      workshopFeedbackNag: this.workshopFeedbackNagAgent,
      stalePhase: this.stalePhaseAgent,
      renewalStalled: this.renewalStalledAgent,
      competitionFollowup: this.competitionFollowupAgent,
      dataCompleteness: this.dataCompletenessAgent,
      schoolDetailsReminder: this.schoolDetailsReminderAgent,
      workshopRescheduler: this.workshopReschedulerAgent,
      workshopScheduler: this.workshopSchedulerAgent,
      googleCalendar: this.googleCalendar,
    };

    const counts = {} as Record<AgentName, number>;
    const errors: Partial<Record<AgentName, string>> = {};
    for (const name of AGENT_NAMES) {
      try {
        counts[name] = await agents[name].scan();
      } catch (err) {
        counts[name] = 0;
        errors[name] = err instanceof Error ? err.message : String(err);
        this.logger.error(`Agent "${name}" failed: ${errors[name]}`, err instanceof Error ? err.stack : undefined);
      }
    }

    this.logger.log(
      `Agent run complete — ${AGENT_NAMES.map((n) => `${n}=${counts[n]}`).join(', ')}` +
        (Object.keys(errors).length ? ` (failed: ${Object.keys(errors).join(', ')})` : ''),
    );
    return { ...counts, errors };
  }
}
