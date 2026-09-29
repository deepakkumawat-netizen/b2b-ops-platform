import { Injectable, Logger } from '@nestjs/common';
import { AgentKey, EmailStatus, SchoolStatus, SuggestionType } from '@b2b-ops/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SCHOOL_DETAILS_REMINDER_TEMPLATE_KEY,
  SCHOOL_DETAILS_REQUEST_TEMPLATE_KEY,
  SchoolAutomationService,
} from '../../automation/school-automation.service';
import { missingSchoolDetails, SCHOOL_DETAILS_SELECT, schoolDetailsCounts } from '../../teacher-form/school-details';
import { AgentSuggestionsService } from '../agent-suggestions.service';

export const REMINDER_EVERY_DAYS = 3;
export const MAX_REMINDERS = 3;

// Fully autonomous and school-facing, like the workshop feedback nag: once
// the school details link has gone out, every 3 days it reminds the school
// of just the parts still empty — at most 3 times, so a school that never
// replies isn't emailed forever (the account manager takes over from there).
@Injectable()
export class SchoolDetailsReminderAgentService {
  private readonly logger = new Logger(SchoolDetailsReminderAgentService.name);

  constructor(
    private prisma: PrismaService,
    private automation: SchoolAutomationService,
    private suggestions: AgentSuggestionsService,
  ) {}

  async scan(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - REMINDER_EVERY_DAYS * 24 * 60 * 60 * 1000);
    const schools = await this.prisma.school.findMany({
      where: {
        status: SchoolStatus.ACTIVE,
        ownerEmail: { not: null },
        emailLogs: { some: { templateKey: SCHOOL_DETAILS_REQUEST_TEMPLATE_KEY, status: EmailStatus.SENT } },
      },
      select: {
        id: true,
        name: true,
        ...SCHOOL_DETAILS_SELECT,
        emailLogs: {
          where: {
            templateKey: { in: [SCHOOL_DETAILS_REQUEST_TEMPLATE_KEY, SCHOOL_DETAILS_REMINDER_TEMPLATE_KEY] },
            status: EmailStatus.SENT,
          },
          select: { templateKey: true, sentAt: true },
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    let sent = 0;
    for (const school of schools) {
      const reminders = school.emailLogs.filter((e) => e.templateKey === SCHOOL_DETAILS_REMINDER_TEMPLATE_KEY).length;
      const lastEmail = school.emailLogs[0]?.sentAt;
      if (reminders >= MAX_REMINDERS || !lastEmail || lastEmail > cutoff) continue;
      const missing = missingSchoolDetails(schoolDetailsCounts(school));
      if (missing.length === 0) continue;
      try {
        if (!(await this.automation.sendSchoolDetailsReminder(school.id, missing))) continue;
      } catch (err) {
        this.logger.warn(`School details reminder failed for ${school.id}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      await this.suggestions.logAutoAction({
        schoolId: school.id,
        agentKey: AgentKey.SCHOOL_DETAILS_REMINDER,
        suggestionType: SuggestionType.SCHOOL_DETAILS_REMINDER_SENT,
        subject: `School details reminder ${reminders + 1}/${MAX_REMINDERS} auto-sent — ${school.name}`,
        body: `Reminded ${school.name} about: ${missing.join(', ')}.`,
        reasoning: `${REMINDER_EVERY_DAYS}+ days since the last school details email and ${missing.length} part(s) still empty.`,
      });
      sent += 1;
    }
    return sent;
  }
}
