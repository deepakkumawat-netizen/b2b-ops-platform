import { Prisma } from '@prisma/client';
import { APP_TIMEZONE, startOfDayInZone } from '../common/time';
import { DraftedSuggestion } from './drafted-suggestion.interface';

// Everything the drafting agents know about a school, so the AI writes a
// ready-to-send email with real names and dates instead of "[School Name]",
// "[Date]" or "[Your Name]" blanks the reviewer has to fill in by hand.
export const SCHOOL_CONTEXT_SELECT = {
  id: true,
  name: true,
  city: true,
  state: true,
  ownerName: true,
  ownerDesignation: true,
  productProgram: true,
  gradeFrom: true,
  gradeTo: true,
  trainingMode: true,
  workshopsCommitted: true,
  currentPhase: true,
  assignedAccountManager: { select: { name: true, email: true } },
} satisfies Prisma.SchoolSelect;

export type SchoolContext = Prisma.SchoolGetPayload<{ select: typeof SCHOOL_CONTEXT_SELECT }>;

function formatDay(date: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** The next `count` working days (Mon–Sat, the school week) after today, in IST. */
export function nextWorkingDays(now: Date, count: number, timeZone = APP_TIMEZONE): Date[] {
  const days: Date[] = [];
  for (let offset = 1; days.length < count && offset < 14; offset++) {
    const day = startOfDayInZone(now, offset, timeZone);
    // Noon avoids any edge where midnight-in-IST reads as the previous day.
    const noon = new Date(day.getTime() + 12 * 3_600_000);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(noon);
    if (weekday !== 'Sun') days.push(noon);
  }
  return days;
}

/** Fact sheet + writing rules appended to every drafting prompt. */
export function schoolFactsForPrompt(school: SchoolContext, now = new Date()): string {
  const manager = school.assignedAccountManager;
  const contact = [school.ownerName, school.ownerDesignation].filter(Boolean).join(', ');
  const location = [school.city, school.state].filter(Boolean).join(', ');
  const grades = school.gradeFrom && school.gradeTo ? `Grades ${school.gradeFrom}–${school.gradeTo}` : null;
  const slots = nextWorkingDays(now, 2).map((d) => formatDay(d));
  const facts = [
    `School: ${school.name}${location ? ` (${location})` : ''}`,
    contact && `School contact: ${contact}`,
    school.productProgram && `Program: ${school.productProgram}${grades ? `, ${grades}` : ''}`,
    school.trainingMode && `Training mode: ${school.trainingMode.toLowerCase()}`,
    school.workshopsCommitted != null && `Workshops committed this year: ${school.workshopsCommitted}`,
    `Account Manager (the sender): ${manager ? `${manager.name}, ${manager.email}` : 'the CodeVidhya team'}`,
    `Today's date: ${formatDay(now)}`,
    `If proposing a meeting, offer: ${slots.join(' or ')}`,
  ].filter(Boolean);
  return (
    `\n\nFacts to use (real values — use them as written):\n- ${facts.join('\n- ')}\n\n` +
    `Rules: Address the school contact by name${school.ownerName ? '' : ' (or "Dear Sir/Madam" if no name is given)'}. ` +
    `Sign off as ${manager ? `${manager.name}, Account Manager, CodeVidhya` : 'Team CodeVidhya'}. ` +
    `Never write placeholders or anything in square brackets like [Name] or [Date] — the email is sent exactly as written.`
  );
}

/** Safety net for a model that ignores the rules: swap the usual blanks for
 * the real values. Anything still bracketed is left for the reviewer and
 * called out in the reasoning so it isn't sent unnoticed. */
export function fillPlaceholders(draft: DraftedSuggestion, school: SchoolContext, now = new Date()): DraftedSuggestion {
  const manager = school.assignedAccountManager;
  const [firstSlot] = nextWorkingDays(now, 1).map((d) => formatDay(d));
  const values: Array<[RegExp, string | null | undefined]> = [
    [/\[(school(?:'s)? name|school|name of (?:the )?school)\]/gi, school.name],
    [/\[(principal(?:'s)? name|owner(?:'s)? name|contact(?: person)?(?:'s)? name|recipient(?:'s)? name|name)\]/gi, school.ownerName],
    [/\[(your name|sender(?:'s)? name|account manager(?:'s)? name|am name)\]/gi, manager?.name],
    [/\[(your email|email|account manager(?:'s)? email)\]/gi, manager?.email],
    [/\[(your title|your designation|designation)\]/gi, manager ? 'Account Manager' : null],
    [/\[(company|company name|organi[sz]ation)\]/gi, 'CodeVidhya'],
    [/\[(city|location)\]/gi, school.city],
    [/\[(program|product|program name)\]/gi, school.productProgram],
    [/\[(today(?:'s)? date|current date)\]/gi, formatDay(now)],
    [/\[(date|proposed date|meeting date)\]/gi, firstSlot],
  ];
  const fill = (text: string) => values.reduce((t, [pattern, value]) => (value ? t.replace(pattern, value) : t), text);
  const subject = fill(draft.subject);
  const body = fill(draft.body);
  const leftover = [...`${subject}\n${body}`.matchAll(/\[[^\]\n]{2,40}\]/g)].map((m) => m[0]);
  const reasoning = leftover.length
    ? `${draft.reasoning} ⚠ Fill in before sending: ${[...new Set(leftover)].join(', ')}.`
    : draft.reasoning;
  return { subject, body, reasoning };
}
