import { DraftedSuggestion } from './drafted-suggestion.interface';

// Both providers are asked for a JSON object but LLMs occasionally still
// wrap it in a ```json fence despite instructions — strip that before
// parsing rather than letting a cosmetic wrapper turn into a dropped draft.
export function parseSuggestionJson(text: string): DraftedSuggestion | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.subject === 'string' && typeof parsed.body === 'string' && typeof parsed.reasoning === 'string') {
      return { subject: parsed.subject, body: parsed.body, reasoning: parsed.reasoning };
    }
    return null;
  } catch {
    return null;
  }
}
