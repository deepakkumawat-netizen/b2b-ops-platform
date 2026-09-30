import { SchoolLifecyclePhase, SuggestionType } from '@b2b-ops/shared';
import { MIN_DAYS_BETWEEN, planWorkshopTimes, schoolYearEnd, WorkshopSchedulerAgentService } from './workshop-scheduler-agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkshopsService } from '../../workshops/workshops.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../../activity/activity.service';
import { SchoolAutomationService } from '../../automation/school-automation.service';
import { StaffNotificationsService } from '../../staff-notifications/staff-notifications.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';

// Midnight in India on a given day.
const istDay = (d: string) => new Date(`${d}T00:00:00+05:30`);
const istIso = (d: Date) => new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString();
const weekday = (d: Date) => new Date(d.getTime() + 5.5 * 60 * 60 * 1000).getUTCDay();
// Wed 30 Sep 2026, midday in India.
const NOW = new Date('2026-09-30T06:30:00Z');

describe('schoolYearEnd', () => {
  it('is the coming 31 March', () => {
    expect(schoolYearEnd(NOW)).toEqual(istDay('2027-03-31'));
    expect(schoolYearEnd(new Date('2027-02-10T06:00:00Z'))).toEqual(istDay('2027-03-31'));
  });
});

describe('planWorkshopTimes', () => {
  it('spreads workshops evenly from two weeks out to the end of the school year, at 11:00 am on weekdays', () => {
    const times = planWorkshopTimes({ count: 4, now: NOW, busyDays: [], holidays: [] });
    expect(times).toHaveLength(4);
    expect(times[0] >= istDay('2026-10-14')).toBe(true);
    expect(times[3] < istDay('2027-04-01')).toBe(true);
    for (const t of times) {
      expect(istIso(t).slice(11, 16)).toBe('11:00');
      expect([1, 2, 3, 4, 5]).toContain(weekday(t));
    }
    const gaps = times.slice(1).map((t, i) => (t.getTime() - times[i].getTime()) / 86_400_000);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(40); // ~6 months over 4 workshops
  });

  it('skips school holidays and days that already have a workshop', () => {
    // 14 Oct 2026 is a Wednesday: the first slot.
    const [first] = planWorkshopTimes({ count: 1, now: NOW, busyDays: [new Date('2026-10-14T08:00:00Z')], holidays: [istDay('2026-10-15')] });
    expect(istIso(first).slice(0, 10)).toBe('2026-10-16');
  });

  it('starts after the school’s own last workshop when given one', () => {
    const [first] = planWorkshopTimes({ count: 1, now: NOW, busyDays: [], holidays: [], notBefore: istDay('2026-12-01') });
    expect(first >= istDay('2026-12-01')).toBe(true);
  });

  it('keeps at least a week between workshops even when the school year is almost over', () => {
    const times = planWorkshopTimes({ count: 3, now: new Date('2027-03-01T06:00:00Z'), busyDays: [], holidays: [] });
    const gaps = times.slice(1).map((t, i) => (t.getTime() - times[i].getTime()) / 86_400_000);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(MIN_DAYS_BETWEEN);
  });

  it('plans nothing when nothing is missing', () => {
    expect(planWorkshopTimes({ count: 0, now: NOW, busyDays: [], holidays: [] })).toEqual([]);
  });
});

describe('WorkshopSchedulerAgentService.scan', () => {
  function makeAgent(school: Record<string, unknown>) {
    let n = 0;
    const prisma = {
      school: { findMany: jest.fn().mockResolvedValue([school]) },
      workshop: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const workshops = {
      create: jest.fn(async (_s: string, dto: { topic: string; targetGrades?: string }) => ({ id: `w${++n}`, topic: dto.topic })),
      confirm: jest.fn(async () => ({ confirmationSentAt: new Date() })),
    };
    const notifications = { sendTemplateEmail: jest.fn().mockResolvedValue(true) };
    const staffNotifications = { notify: jest.fn() };
    const suggestions = { logAutoAction: jest.fn() };
    const automation = { managerRecipients: jest.fn().mockResolvedValue({ recipients: ['asha@codevidhya.com'], managerName: 'Asha' }) };
    const agent = new WorkshopSchedulerAgentService(
      prisma as unknown as PrismaService,
      workshops as unknown as WorkshopsService,
      notifications as unknown as NotificationsService,
      { record: jest.fn() } as unknown as ActivityService,
      automation as unknown as SchoolAutomationService,
      staffNotifications as unknown as StaffNotificationsService,
      suggestions as unknown as AgentSuggestionsService,
    );
    return { agent, prisma, workshops, notifications, staffNotifications, suggestions };
  }

  const school = {
    id: 's1',
    name: 'DPS',
    productProgram: 'AI',
    gradeFrom: '6',
    gradeTo: '8',
    workshopsCommitted: 4,
    currentPhase: SchoolLifecyclePhase.ONGOING_ENGAGEMENT,
    workshops: [{ scheduledAt: new Date('2026-10-05T05:30:00Z') }],
    blockedDates: [],
  };

  it('adds only the missing workshops, emails the school each date and tells the manager', async () => {
    const { agent, workshops, notifications, staffNotifications, suggestions } = makeAgent(school);
    expect(await agent.scan(NOW)).toBe(3);
    expect(workshops.create.mock.calls.map((c) => c[1].topic)).toEqual(['AI workshop 2 of 4', 'AI workshop 3 of 4', 'AI workshop 4 of 4']);
    expect(workshops.create.mock.calls[0][1].targetGrades).toBe('6-8');
    expect(workshops.confirm).toHaveBeenCalledTimes(3);
    const managerEmail = notifications.sendTemplateEmail.mock.calls[0][0];
    expect(managerEmail.recipient).toBe('asha@codevidhya.com');
    expect(managerEmail.body).toContain('AI workshop 4 of 4');
    expect(staffNotifications.notify.mock.calls[0][1]).toBe('WORKSHOPS_AUTO_SCHEDULED');
    expect(suggestions.logAutoAction.mock.calls[0][0].suggestionType).toBe(SuggestionType.WORKSHOPS_AUTO_SCHEDULED);
  });

  it('does nothing when every committed workshop is already on the calendar', async () => {
    const { agent, workshops } = makeAgent({ ...school, workshopsCommitted: 1 });
    expect(await agent.scan(NOW)).toBe(0);
    expect(workshops.create).not.toHaveBeenCalled();
  });
});
