import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentKey, SuggestionStatus, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { schoolScopeWhere } from '../common/scope';
import { DraftedSuggestion } from './drafted-suggestion.interface';
import { UpdateAgentSuggestionDto } from './dto/update-agent-suggestion.dto';

@Injectable()
export class AgentSuggestionsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  list(staff: StaffJwtPayload) {
    return this.prisma.agentSuggestion.findMany({
      where: { school: schoolScopeWhere(staff) },
      include: { school: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Called by each agent scanner. Skips (returns null) if a PENDING
   * suggestion of this exact (schoolId, agentKey, suggestionType) already
   * exists — application-level de-dup so a school doesn't get re-nudged
   * every time the scan runs before someone reviews the last one. */
  async createIfNotDuplicate(params: {
    schoolId: string;
    agentKey: AgentKey;
    suggestionType: SuggestionType;
    draft: DraftedSuggestion;
  }) {
    const { schoolId, agentKey, suggestionType, draft } = params;
    const existing = await this.prisma.agentSuggestion.findFirst({
      where: { schoolId, agentKey, suggestionType, status: SuggestionStatus.PENDING },
    });
    if (existing) return null;
    return this.prisma.agentSuggestion.create({
      data: {
        schoolId,
        agentKey,
        suggestionType,
        draftSubject: draft.subject,
        draftBody: draft.body,
        reasoning: draft.reasoning,
      },
    });
  }

  /** Called by fully-autonomous agents (WorkshopReminderAgentService,
   * RenewalCycleOpenerAgentService) AFTER they've already taken the real
   * action (sent the reminder, opened the cycle) — this row is a pure audit
   * entry, never something a human approves. reviewedByStaffId stays null
   * (no human reviewed it) while reviewedAt is set to when it happened, so
   * the two are distinguishable from a human-approved SENT suggestion. */
  async logAutoAction(params: {
    schoolId: string;
    agentKey: AgentKey;
    suggestionType: SuggestionType;
    subject: string;
    body: string;
    reasoning: string;
  }) {
    return this.prisma.agentSuggestion.create({
      data: {
        schoolId: params.schoolId,
        agentKey: params.agentKey,
        suggestionType: params.suggestionType,
        draftSubject: params.subject,
        draftBody: params.body,
        reasoning: params.reasoning,
        status: SuggestionStatus.AUTO_SENT,
        reviewedAt: new Date(),
      },
    });
  }

  async update(id: string, dto: UpdateAgentSuggestionDto, staff: StaffJwtPayload) {
    const suggestion = await this.findScoped(id, staff);
    return this.prisma.agentSuggestion.update({ where: { id: suggestion.id }, data: dto });
  }

  async approve(id: string, staff: StaffJwtPayload) {
    const suggestion = await this.findScoped(id, staff);
    await this.notifications.sendTemplateEmail({
      schoolId: suggestion.schoolId,
      recipient: suggestion.school.ownerEmail,
      templateKey: `agent_${suggestion.suggestionType.toLowerCase()}`,
      subject: suggestion.draftSubject,
      body: suggestion.draftBody,
    });
    return this.prisma.agentSuggestion.update({
      where: { id: suggestion.id },
      data: { status: SuggestionStatus.SENT, reviewedByStaffId: staff.sub, reviewedAt: new Date() },
    });
  }

  async reject(id: string, staff: StaffJwtPayload) {
    const suggestion = await this.findScoped(id, staff);
    return this.prisma.agentSuggestion.update({
      where: { id: suggestion.id },
      data: { status: SuggestionStatus.REJECTED, reviewedByStaffId: staff.sub, reviewedAt: new Date() },
    });
  }

  private async findScoped(id: string, staff: StaffJwtPayload) {
    const suggestion = await this.prisma.agentSuggestion.findFirst({
      where: { id, school: schoolScopeWhere(staff) },
      include: { school: true },
    });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    return suggestion;
  }
}
