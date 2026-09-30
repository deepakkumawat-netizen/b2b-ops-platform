import { SuggestionType, WorkshopStatus } from '@b2b-ops/shared';
import { MAX_AUTO_RESCHEDULES, pickRescheduleDate, WorkshopReschedulerAgentService } from './workshop-rescheduler-agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkshopsService } from '../../workshops/workshops.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../../activity/activity.service';
import { SchoolAutomationService } from '../../automation/school-automation.service';
import { AgentSuggestionsService } from '../agent-suggestions.service';
import { StaffNotificationsService } from '../../staff-notifications/staff-notifications.service';

// Midnight in India (UTC+5:30) on a given day.
const istDay = (d: string) => new Date(`${d}T00:00:00+05:30`);
const NOW = new Date('2026-10-01T06:00:00Z');
// 11:00 AM IST on 10 Oct.
const CURRENT = new Date('2026-10-10T05:30:00Z');

describe('pickRescheduleDate', () => {
  it('uses the first preferred day and keeps the original time of day', () => {
    const at = pickRescheduleDate({ preferredDays: [istDay('2026-10-15'), istDay('2026-10-16')], currentAt: CURRENT, otherWorkshopDays: [], now: NOW });
    expect(at).toEqual(new Date('2026-10-15T05:30:00Z'));
  });

  it('skips days that are too soon, already have a workshop, or are the current day', () => {
    const at = pickRescheduleDate({
      preferredDays: [istDay('2026-10-02'), istDay('2026-10-10'), istDay('2026-10-12'), istDay('2026-10-14')],
      currentAt: CURRENT,
      otherWorkshopDays: [new Date('2026-10-12T08:00:00Z')],
      now: NOW,
    });
    expect(at).toEqual(new Date('2026-10-14T05:30:00Z'));
  });

  it('skips days the school marked as holidays', () => {
    const at = pickRescheduleDate({
      preferredDays: [istDay('2026-10-15'), istDay('2026-10-16')],
      currentAt: CURRENT,
      otherWorkshopDays: [],
      blockedDays: [istDay('2026-10-15')],
      now: NOW,
    });
    expect(at).toEqual(new Date('2026-10-16T05:30:00Z'));
  });

  it('returns null when no preferred day works', () => {
    expect(pickRescheduleDate({ preferredDays: [istDay('2026-10-02')], currentAt: CURRENT, otherWorkshopDays: [], now: NOW })).toBeNull();
  });
});

function makeAgent(overrides: Partial<{ autoRescheduleCount: number; preferredDates: Date[] }> = {}) {
  const workshop = {
    id: 'w1',
    schoolId: 's1',
    topic: 'AI Basics',
    status: WorkshopStatus.CONFIRMED,
    scheduledAt: CURRENT,
    changeRequestedAt: new Date(),
    changeReason: 'Exams that week',
    preferredDates: [istDay('2026-10-15')],
    autoRescheduleCount: 0,
    ...overrides,
    school: { id: 's1', name: 'DPS', ownerName: 'Mrs Rao', ownerEmail: 'owner@dps.in', workshops: [], blockedDates: [] as { day: Date }[] },
  };
  const prisma = {
    workshop: { findUnique: jest.fn().mockResolvedValue(workshop), update: jest.fn().mockResolvedValue({}) },
    school: {
      findUnique: jest.fn().mockResolvedValue({ assignedAccountManager: { name: 'Asha', email: 'asha@codevidhya.com', isActive: true } }),
    },
  };
  const workshops = {
    reschedule: jest.fn().mockResolvedValue({ confirmationSentAt: new Date() }),
    responseLink: jest.fn().mockReturnValue('https://ops.example/workshop/w1/token'),
    calendarLink: jest.fn().mockReturnValue('https://ops.example/calendar/s1/token'),
  };
  const notifications = { sendTemplateEmail: jest.fn().mockResolvedValue(true) };
  const activity = { record: jest.fn() };
  const automation = { managerRecipients: jest.fn().mockResolvedValue({ recipients: ['asha@codevidhya.com'], managerName: 'Asha' }) };
  const suggestions = { logAutoAction: jest.fn() };
  const staffNotifications = { notify: jest.fn() };
  const agent = new WorkshopReschedulerAgentService(
    prisma as unknown as PrismaService,
    workshops as unknown as WorkshopsService,
    notifications as unknown as NotificationsService,
    activity as unknown as ActivityService,
    automation as unknown as SchoolAutomationService,
    suggestions as unknown as AgentSuggestionsService,
    staffNotifications as unknown as StaffNotificationsService,
  );
  const emailsTo = (recipient: string) => notifications.sendTemplateEmail.mock.calls.map((c) => c[0]).filter((e) => e.recipient === recipient);
  const bell = () => staffNotifications.notify.mock.calls.map((c) => c[1]);
  return { agent, prisma, workshops, notifications, suggestions, emailsTo, bell };
}

describe('WorkshopReschedulerAgentService.handleRequest', () => {
  it("moves the workshop to the school's date and emails the manager", async () => {
    const { agent, workshops, emailsTo, suggestions, prisma, bell } = makeAgent();
    expect(await agent.handleRequest('w1', NOW)).toBe('rescheduled');
    expect(workshops.reschedule).toHaveBeenCalledWith('s1', 'w1', {
      scheduledAt: '2026-10-15T05:30:00.000Z',
      reason: 'Requested by your team: Exams that week',
    });
    expect(prisma.workshop.update).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { autoRescheduleCount: { increment: 1 } } });
    const [managerEmail] = emailsTo('asha@codevidhya.com');
    expect(managerEmail.templateKey).toBe('workshop_auto_rescheduled_manager');
    expect(managerEmail.body).toContain('Exams that week');
    expect(suggestions.logAutoAction.mock.calls[0][0].suggestionType).toBe(SuggestionType.WORKSHOP_AUTO_RESCHEDULED);
    expect(bell()).toEqual(['WORKSHOP_MOVED']);
  });

  it('asks the school for other dates when none work, and tells the manager', async () => {
    const { agent, workshops, emailsTo, bell } = makeAgent({ preferredDates: [istDay('2026-10-02')] });
    expect(await agent.handleRequest('w1', NOW)).toBe('asked_again');
    expect(workshops.reschedule).not.toHaveBeenCalled();
    const [schoolEmail] = emailsTo('owner@dps.in');
    expect(schoolEmail.templateKey).toBe('workshop_reschedule_dates_unavailable');
    expect(schoolEmail.button.url).toBe('https://ops.example/workshop/w1/token');
    expect(emailsTo('asha@codevidhya.com')).toHaveLength(1);
    expect(bell()).toEqual(['WORKSHOP_DATES_UNAVAILABLE']);
  });

  it('hands over to the manager after the automatic move limit', async () => {
    const { agent, workshops, emailsTo, notifications, bell } = makeAgent({ autoRescheduleCount: MAX_AUTO_RESCHEDULES });
    expect(await agent.handleRequest('w1', NOW)).toBe('needs_manager');
    expect(workshops.reschedule).not.toHaveBeenCalled();
    expect(emailsTo('asha@codevidhya.com')[0].templateKey).toBe('workshop_reschedule_needs_manager');
    expect(notifications.sendTemplateEmail).toHaveBeenCalledTimes(1); // nothing to the school
    expect(bell()).toEqual(['WORKSHOP_NEEDS_MANAGER']);
  });

  it('does nothing when there is no pending request', async () => {
    const { agent, prisma, notifications, bell } = makeAgent({ preferredDates: [] });
    expect(await agent.handleRequest('w1', NOW)).toBe('nothing');
    expect(prisma.workshop.update).not.toHaveBeenCalled();
    expect(notifications.sendTemplateEmail).not.toHaveBeenCalled();
    expect(bell()).toEqual([]);
  });
});
