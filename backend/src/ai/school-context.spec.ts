import { fillPlaceholders, nextWorkingDays, SchoolContext, schoolFactsForPrompt } from './school-context';

const school = {
  id: 's1',
  name: 'Sunrise Public School',
  city: 'Jaipur',
  state: 'Rajasthan',
  ownerName: 'Mrs. Sharma',
  ownerDesignation: 'Principal',
  productProgram: 'Coding',
  gradeFrom: '3',
  gradeTo: '8',
  trainingMode: 'OFFLINE',
  workshopsCommitted: 4,
  currentPhase: 'ONGOING_ENGAGEMENT',
  assignedAccountManager: { name: 'Aditi Rao', email: 'aditi@codevidhya.com' },
} as SchoolContext;

// Saturday 3 Oct 2026, 10:00 IST
const now = new Date('2026-10-03T04:30:00Z');

describe('school-context', () => {
  it('skips Sunday when picking the next working days', () => {
    const days = nextWorkingDays(now, 2).map((d) => d.toISOString().slice(0, 10));
    expect(days).toEqual(['2026-10-05', '2026-10-06']);
  });

  it('gives the AI the real names, sender and dates', () => {
    const facts = schoolFactsForPrompt(school, now);
    expect(facts).toContain('Sunrise Public School (Jaipur, Rajasthan)');
    expect(facts).toContain('Mrs. Sharma, Principal');
    expect(facts).toContain('Sign off as Aditi Rao, Account Manager, CodeVidhya');
    expect(facts).toContain('Monday, 5 October 2026');
    expect(facts).toMatch(/Never write placeholders/);
  });

  it('fills the usual blanks and flags any it cannot', () => {
    const out = fillPlaceholders(
      {
        subject: 'Check-in with [School Name]',
        body: 'Dear [Principal Name],\nCan we meet on [Date]? [Custom note]\nRegards,\n[Your Name]',
        reasoning: 'Visit overdue.',
      },
      school,
      now,
    );
    expect(out.subject).toBe('Check-in with Sunrise Public School');
    expect(out.body).toContain('Dear Mrs. Sharma,');
    expect(out.body).toContain('meet on Monday, 5 October 2026?');
    expect(out.body).toContain('Aditi Rao');
    expect(out.reasoning).toBe('Visit overdue. ⚠ Fill in before sending: [Custom note].');
  });

  it('leaves a blank it has no value for, and says so', () => {
    const out = fillPlaceholders({ subject: 'Hi', body: 'Dear [Principal Name],', reasoning: 'r' }, { ...school, ownerName: null }, now);
    expect(out.body).toBe('Dear [Principal Name],');
    expect(out.reasoning).toContain('[Principal Name]');
  });
});
