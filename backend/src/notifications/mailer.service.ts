import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { emailHtml, MailButton } from './email-html';

// Thin wrapper so the rest of the app never touches an email provider
// directly. HTTPS APIs only — Render's free plan blocks outbound SMTP
// (ports 25/465/587), so Gmail/SMTP isn't an option there.
//
// Two providers, tried in order:
//  1. Brevo (BREVO_API_KEY) — preferred. Its single-sender verification
//     (click a link sent to BREVO_FROM) lets us send as an @codevidhya.com
//     address without touching codevidhya.com's DNS, which we don't control.
//  2. Resend (RESEND_API_KEY) — only delivers to the Resend account owner
//     until codevidhya.com's DNS records are added in Route 53.
//
// `sender` (e.g. a school's account manager) is who the email should come
// from. Brevo only sends as addresses verified in its dashboard, so an
// unverified sender goes out from BREVO_FROM under the manager's name with
// Reply-To set to the manager — replies still reach them. Verifying the
// manager's address in Brevo makes it the real From, no deploy needed.
//
// Best-effort: never throws. Returns whether the send actually succeeded so
// NotificationsService can record an accurate EmailLog row, but a failure
// here must never block the caller's request (e.g. marking a checklist task
// done must never 500 because email failed).
export interface MailSender {
  email: string;
  name: string;
}

const SENDERS_CACHE_MS = 10 * 60 * 1000;

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly brevoApiKey?: string;
  private readonly brevoFrom?: string;
  private readonly brevoFromName: string;
  private readonly resendApiKey?: string;
  private readonly resendFrom: string;

  constructor(private config: ConfigService) {
    this.brevoApiKey = this.config.get<string>('BREVO_API_KEY') || undefined;
    this.brevoFrom = this.config.get<string>('BREVO_FROM') || undefined;
    this.brevoFromName = this.config.get<string>('BREVO_FROM_NAME') || 'codevidhya B2B Ops';
    this.resendApiKey = this.config.get<string>('RESEND_API_KEY') || undefined;
    this.resendFrom = this.config.get<string>('RESEND_FROM') ?? 'onboarding@resend.dev';
  }

  isConfigured(): boolean {
    return this.useBrevo() || !!this.resendApiKey;
  }

  async sendMail(
    to: string,
    subject: string,
    text: string,
    sender?: MailSender,
    button?: MailButton,
  ): Promise<{ sent: boolean; response?: string }> {
    const html = button ? emailHtml(text, button) : undefined;
    if (this.useBrevo()) {
      let from = { email: this.brevoFrom!, name: this.brevoFromName };
      let replyTo: MailSender | undefined;
      if (sender) {
        if (await this.isVerifiedBrevoSender(sender.email)) {
          from = { email: sender.email, name: sender.name };
        } else {
          from = { email: this.brevoFrom!, name: `${sender.name} via codevidhya` };
          replyTo = sender;
        }
      }
      return this.post('Brevo', 'https://api.brevo.com/v3/smtp/email', { 'api-key': this.brevoApiKey! }, to, {
        sender: from,
        to: [{ email: to }],
        ...(replyTo && { replyTo }),
        subject,
        textContent: text,
        ...(html && { htmlContent: html }),
      });
    }
    if (this.resendApiKey) {
      return this.post('Resend', 'https://api.resend.com/emails', { Authorization: `Bearer ${this.resendApiKey}` }, to, {
        from: this.resendFrom,
        to,
        ...(sender && { reply_to: sender.email }),
        subject,
        text,
        ...(html && { html }),
      });
    }
    this.logger.log(`Email not configured — skipping email to ${to}: "${subject}"`);
    return { sent: false, response: 'No email provider configured' };
  }

  private useBrevo(): boolean {
    return !!this.brevoApiKey && !!this.brevoFrom;
  }

  // Cached so a burst of sends (e.g. the daily agent run) doesn't hit
  // Brevo's senders endpoint once per email; short enough that a manager
  // verified in the dashboard starts sending as themselves within minutes.
  private verifiedSenders?: { emails: Set<string>; fetchedAt: number };

  private async isVerifiedBrevoSender(email: string): Promise<boolean> {
    if (!this.verifiedSenders || Date.now() - this.verifiedSenders.fetchedAt > SENDERS_CACHE_MS) {
      try {
        const res = await fetch('https://api.brevo.com/v3/senders', {
          headers: { Accept: 'application/json', 'api-key': this.brevoApiKey! },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const body = (await res.json()) as { senders?: { email: string; active: boolean }[] };
        const emails = (body.senders ?? []).filter((s) => s.active).map((s) => s.email.toLowerCase());
        this.verifiedSenders = { emails: new Set(emails), fetchedAt: Date.now() };
      } catch (err) {
        // Unknown ⇒ treat as unverified: sending via BREVO_FROM + Reply-To
        // always works, whereas guessing "verified" wrong gets rejected.
        this.logger.warn(`Could not load Brevo senders: ${err instanceof Error ? err.message : err}`);
        return false;
      }
    }
    return this.verifiedSenders.emails.has(email.toLowerCase());
  }

  private async post(
    provider: string,
    url: string,
    authHeaders: Record<string, string>,
    to: string,
    payload: unknown,
  ): Promise<{ sent: boolean; response?: string }> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`${provider} request failed (${res.status}) sending to ${to}: ${body}`);
        return { sent: false, response: `${provider} HTTP ${res.status}: ${body}` };
      }
      return { sent: true, response: provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to send email to ${to} via ${provider}: ${message}`);
      return { sent: false, response: message };
    }
  }
}
