import { Injectable } from '@nestjs/common';
import { EmailStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';

// Every touchpoint email the SOP calls for (welcome email, workshop
// confirmation/reminder/completion) goes through here, never MailerService
// directly, so every attempt gets an EmailLog row regardless of whether the
// send actually succeeded (best-effort — see mailer.service.ts).
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
  }): Promise<void> {
    const { schoolId, recipient, templateKey, subject, body } = params;
    if (!recipient) {
      await this.prisma.emailLog.create({
        data: { schoolId, recipient: '(none)', templateKey, subject, status: EmailStatus.SKIPPED, providerResponse: 'No recipient email on file' },
      });
      return;
    }
    if (!this.mailer.isConfigured()) {
      await this.prisma.emailLog.create({
        data: { schoolId, recipient, templateKey, subject, status: EmailStatus.SKIPPED, providerResponse: 'RESEND_API_KEY not set' },
      });
      return;
    }
    const result = await this.mailer.sendMail(recipient, subject, body);
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
  }
}
