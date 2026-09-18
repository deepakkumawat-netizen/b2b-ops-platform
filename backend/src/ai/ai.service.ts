import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { GroqService } from './groq.service';
import { DraftedSuggestion } from './drafted-suggestion.interface';

// The one thing agent scanners call. Tries Gemini first, falls back to Groq
// on any failure, returns null (never throws) if both are unconfigured or
// fail — a scanner treats null exactly like "nothing to suggest here" and
// simply doesn't create an AgentSuggestion row.
@Injectable()
export class AiService {
  constructor(
    private gemini: GeminiService,
    private groq: GroqService,
  ) {}

  async draftSuggestion(prompt: string): Promise<DraftedSuggestion | null> {
    const viaGemini = await this.gemini.draft(prompt);
    if (viaGemini) return viaGemini;
    return this.groq.draft(prompt);
  }
}
