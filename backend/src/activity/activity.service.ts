import { Injectable, Logger } from '@nestjs/common';
import { SuggestionStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';

export type ActivityKind = 'ACTION' | 'EMAIL' | 'AGENT' | 'ENGAGEMENT';

export type ActivityEntry = {
  id: string;
  at: Date;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  actor: string | null;
};

const TIMELINE_LIMIT_PER_SOURCE = 100;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private prisma: PrismaService) {}

  /** Best-effort: an audit write failing must never fail the action it
   * describes (the school update already happened). */
  async record(schoolId: string, actor: StaffJwtPayload | null, action: string, detail?: string | null): Promise<void> {
    try {
      await this.prisma.schoolActivity.create({
        data: { schoolId, actorStaffId: actor?.sub ?? null, action, detail: detail ?? null },
      });
    } catch (err) {
      this.logger.warn(`Failed to record activity "${action}" for school ${schoolId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** One newest-first history for a school, merged from every table that
   * already records something happening — human actions, emails, agent
   * drafts/auto-actions and logged visits/calls. */
  async timeline(schoolId: string): Promise<ActivityEntry[]> {
    const take = TIMELINE_LIMIT_PER_SOURCE;
    const [actions, emails, suggestions, engagements] = await Promise.all([
      this.prisma.schoolActivity.findMany({
        where: { schoolId },
        include: { actorStaff: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.emailLog.findMany({ where: { schoolId }, orderBy: { sentAt: 'desc' }, take }),
      this.prisma.agentSuggestion.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' }, take }),
      this.prisma.engagementLog.findMany({
        where: { schoolId },
        include: { conductedByStaff: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);

    const entries: ActivityEntry[] = [
      ...actions.map((a) => ({
        id: `action-${a.id}`,
        at: a.createdAt,
        kind: 'ACTION' as const,
        title: a.action,
        detail: a.detail,
        actor: a.actorStaff?.name ?? null,
      })),
      ...emails.map((e) => ({
        id: `email-${e.id}`,
        at: e.sentAt,
        kind: 'EMAIL' as const,
        title: `Email ${e.status.toLowerCase()}: ${e.subject}`,
        detail: e.status === 'SENT' ? `To ${e.recipient}` : `To ${e.recipient} — ${e.providerResponse ?? 'not delivered'}`,
        actor: null,
      })),
      ...suggestions.map((s) => ({
        id: `agent-${s.id}`,
        at: s.createdAt,
        kind: 'AGENT' as const,
        title: s.status === SuggestionStatus.AUTO_SENT ? s.draftSubject : `AI drafted: ${s.draftSubject}`,
        detail: s.reasoning,
        actor: 'AI agent',
      })),
      ...engagements.map((g) => ({
        id: `engagement-${g.id}`,
        at: g.createdAt,
        kind: 'ENGAGEMENT' as const,
        title: g.type === 'MONTHLY_VISIT' ? 'Monthly visit logged' : 'Weekly call logged',
        detail: g.summary,
        actor: g.conductedByStaff?.name ?? null,
      })),
    ];
    return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
  }
}
