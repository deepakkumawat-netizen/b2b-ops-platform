import { Injectable } from '@nestjs/common';
import { EmailStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService, MailSender } from './mailer.service';

// Every touchpoint email the SOP calls for (welcome email, workshop
// confirmation/reminder/completion) goes through here, never MailerService
// directly, so every attempt gets an EmailLog row regardless of whether the
// send actually succeeded (best-effort — see mailer.service.ts). Resolves
// to whether it was actually sent, so callers only mark a step "sent" when
// it was.
@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
  ) {}

  async sendTemplateEmail(params: {
    schoolId?: string;
    recipient: string | null | undefined;
    templateKey: string;
    subject: string;
    body: string;
    /** false for internal emails about a school (e.g. the admin
     * new-enrollment alert) — those shouldn't come "from" its manager. */
    fromAccountManager?: boolean;
  }): Promise<boolean> {
    const { schoolId, recipient, templateKey, subject, body, fromAccountManager = true } = params;
    if (!recipient) {
      await this.prisma.emailLog.create({
        data: { schoolId, recipient: '(none)', templateKey, subject, status: EmailStatus.SKIPPED, providerResponse: 'No recipient email on file' },
      });
      return false;
    }
    if (!this.mailer.isConfigured()) {
      await this.prisma.emailLog.create({
        data: { schoolId, recipient, templateKey, subject, status: EmailStatus.SKIPPED, providerResponse: 'No email provider configured (BREVO_API_KEY / RESEND_API_KEY)' },
      });
      return false;
    }
    const sender = fromAccountManager ? await this.schoolSender(schoolId) : undefined;
    const result = await this.mailer.sendMail(recipient, subject, body, sender);
    await this.prisma.emailLog.create({
      data: {
        schoolId,
        recipient,
        templateKey,
        subject,
        status: result.sent ? EmailStatus.SENT : EmailStatus.FAILED,
        providerResponse: result.response,
      },
    });
    return result.sent;
  }

  // School-facing emails come from the school's assigned account manager
  // (their point of contact); staff emails (no schoolId) use the default
  // sender. An inactive manager falls back to the default too.
  private async schoolSender(schoolId?: string): Promise<MailSender | undefined> {
    if (!schoolId) return undefined;
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { assignedAccountManager: { select: { name: true, email: true, isActive: true } } },
    });
    const manager = school?.assignedAccountManager;
    return manager?.isActive ? { name: manager.name, email: manager.email } : undefined;
  }
}
