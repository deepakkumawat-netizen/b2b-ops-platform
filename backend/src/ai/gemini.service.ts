import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DraftedSuggestion } from './drafted-suggestion.interface';
import { parseSuggestionJson } from './parse-suggestion';

const SUGGESTION_JSON_INSTRUCTIONS =
  'Respond with ONLY a JSON object of the exact shape {"subject": string, "body": string, "reasoning": string} — no markdown fences, no extra text. "subject" is an email subject line, "body" is the full email body (plain text, ready to send), "reasoning" is one sentence explaining to the reviewing staff member why this was drafted.';

// Primary AI provider. Never throws — returns null on any failure so
// AiService can fall back to Groq, same degrade-gracefully contract as
// MailerService.sendMail().
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') || undefined;
    this.model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async draft(prompt: string): Promise<DraftedSuggestion | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${prompt}\n\n${SUGGESTION_JSON_INSTRUCTIONS}` }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Gemini request failed (${res.status}): ${await res.text()}`);
        return null;
      }
      const data = await res.json();
      const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return parseSuggestionJson(text);
    } catch (err) {
      this.logger.warn(`Gemini call failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
