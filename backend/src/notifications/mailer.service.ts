import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Thin wrapper so the rest of the app never touches an email provider
// directly. Resend only (plain HTTPS API) — no SMTP fallback needed since
// this app isn't deployed anywhere that blocks outbound SMTP; if that
// changes later, port TicketPlatform's SMTP-fallback MailerService.
//
// Best-effort: never throws. Returns whether the send actually succeeded so
// NotificationsService can record an accurate EmailLog row, but a failure
// here must never block the caller's request (e.g. marking a checklist task
// done must never 500 because email failed).
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resendApiKey?: string;
  private readonly resendFrom: string;

  constructor(private config: ConfigService) {
    this.resendApiKey = this.config.get<string>('RESEND_API_KEY') || undefined;
    this.resendFrom = this.config.get<string>('RESEND_FROM') ?? 'onboarding@resend.dev';
  }

  isConfigured(): boolean {
    return !!this.resendApiKey;
  }

  async sendMail(to: string, subject: string, text: string): Promise<{ sent: boolean; response?: string }> {
    if (!this.resendApiKey) {
      this.logger.log(`Email not configured — skipping email to ${to}: "${subject}"`);
      return { sent: false, response: 'RESEND_API_KEY not set' };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.resendApiKey}` },
        body: JSON.stringify({ from: this.resendFrom, to, subject, text }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Resend request failed (${res.status}) sending to ${to}: ${body}`);
        return { sent: false, response: `HTTP ${res.status}: ${body}` };
      }
      return { sent: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to send email to ${to} via Resend: ${message}`);
      return { sent: false, response: message };
    }
  }
}
