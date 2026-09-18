import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DraftedSuggestion } from './drafted-suggestion.interface';
import { parseSuggestionJson } from './parse-suggestion';

const SUGGESTION_JSON_INSTRUCTIONS =
  'Respond with ONLY a JSON object of the exact shape {"subject": string, "body": string, "reasoning": string} — no markdown fences, no extra text. "subject" is an email subject line, "body" is the full email body (plain text, ready to send), "reasoning" is one sentence explaining to the reviewing staff member why this was drafted.';

// Fallback provider — used only when Gemini is unset or fails (e.g. its
// free-tier 5-req/min ceiling). Never throws — returns null on any failure,
// at which point AiService.draftSuggestion() itself returns null and no
// suggestion is created (same degrade-gracefully contract as MailerService).
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('GROQ_API_KEY') || undefined;
    this.model = this.config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-20b';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async draft(prompt: string): Promise<DraftedSuggestion | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: `${prompt}\n\n${SUGGESTION_JSON_INSTRUCTIONS}` }],
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Groq request failed (${res.status}): ${await res.text()}`);
        return null;
      }
      const data = await res.json();
      const text: string | undefined = data.choices?.[0]?.message?.content;
      if (!text) return null;
      return parseSuggestionJson(text);
    } catch (err) {
      this.logger.warn(`Groq call failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
