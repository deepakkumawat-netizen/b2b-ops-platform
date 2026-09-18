// What every provider (Gemini, Groq) and every agent scanner works with —
// the shape an AgentSuggestion row is built from. `reasoning` is shown to
// the reviewing staff member so they can judge the draft without re-deriving
// why the agent thought it was worth surfacing.
export interface DraftedSuggestion {
  subject: string;
  body: string;
  reasoning: string;
}
