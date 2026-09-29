import { SchoolDetailsReminderAgentService } from './school-details-reminder-agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolAutomationService } from '../../automation/school-automation.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

const now = new Date('2026-10-10T06:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

function school(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    name: 'DPS',
    orientationPreferredDate: null,
    infraDiagnostic: null,
    assets: [],
    _count: { teachers: 3, students: 0 },
    emailLogs: [{ templateKey: 'teacher_details_request', sentAt: daysAgo(4) }],
    ...overrides,
  };
}

function makeAgent(schools: unknown[], sent = true) {
  const prisma = { school: { findMany: jest.fn(async () => schools) } };
  const automation = { sendSchoolDetailsReminder: jest.fn().mockResolvedValue(sent) };
  const suggestions = { logAutoAction: jest.fn().mockResolvedValue(undefined) };
  const agent = new SchoolDetailsReminderAgentService(
    prisma as unknown as PrismaService,
    automation as unknown as SchoolAutomationService,
    suggestions as unknown as AgentSuggestionsService,
  );
  return { agent, automation, suggestions };
}

describe('SchoolDetailsReminderAgentService', () => {
  it('reminds a school about only the parts still empty, 3+ days after the last email', async () => {
    const { agent, automation, suggestions } = makeAgent([school()]);
    expect(await agent.scan(now)).toBe(1);
    expect(automation.sendSchoolDetailsReminder).toHaveBeenCalledWith('s1', [
      'Student details (name and grade)',
      'School logo',
      'Computer lab and internet',
      'Preferred orientation date',
    ]);
    expect(suggestions.logAutoAction).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining('1/3') }));
  });

  it('waits 3 days after the last email, stops after 3 reminders, and skips complete schools', async () => {
    const recent = school({ id: 'recent', emailLogs: [{ templateKey: 'school_details_reminder', sentAt: daysAgo(1) }] });
    const maxed = school({
      id: 'maxed',
      emailLogs: [9, 12, 15].map((d) => ({ templateKey: 'school_details_reminder', sentAt: daysAgo(d) })),
    });
    const complete = school({
      id: 'complete',
      orientationPreferredDate: now,
      infraDiagnostic: { id: 'i1' },
      assets: [{ id: 'a1' }],
      _count: { teachers: 2, students: 40 },
    });
    const { agent, automation } = makeAgent([recent, maxed, complete]);
    expect(await agent.scan(now)).toBe(0);
    expect(automation.sendSchoolDetailsReminder).not.toHaveBeenCalled();
  });

  it('does not count a reminder whose email failed', async () => {
    const { agent, suggestions } = makeAgent([school()], false);
    expect(await agent.scan(now)).toBe(0);
    expect(suggestions.logAutoAction).not.toHaveBeenCalled();
  });
});
