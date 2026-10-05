import { FestivalHolidaysAgentService, upcomingFestivals } from './festival-holidays-agent.service';
import { startOfDayInZone } from '../../common/time';

const day = (iso: string) => startOfDayInZone(new Date(`${iso}T12:00:00Z`));

describe('upcomingFestivals', () => {
  it('returns festivals from today for the next year only', () => {
    const names = upcomingFestivals(new Date('2026-11-01T06:00:00Z')).map((f) => f.name);
    expect(names).toContain('Diwali');
    expect(names).not.toContain('Dussehra'); // already past
    expect(names.filter((n) => n === 'Christmas')).toHaveLength(1); // Christmas 2027 is more than a year out
  });
});

describe('FestivalHolidaysAgentService.scan', () => {
  function make(applied: Date[], existingHoliday: Date | null) {
    const prisma = {
      school: { findMany: jest.fn().mockResolvedValue([{ id: 's1', name: 'DPS', festivalsApplied: applied.map((d) => ({ day: d })) }]) },
      schoolBlockedDate: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(existingHoliday && where.schoolId_day.day.getTime() === existingHoliday.getTime() ? { id: 'h' } : null),
        ),
        create: jest.fn().mockResolvedValue({}),
      },
      schoolFestivalApplied: { create: jest.fn().mockResolvedValue({}) },
      workshop: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const activity = { record: jest.fn() };
    const agent = new FestivalHolidaysAgentService(prisma as never, {} as never, activity as never, {} as never, {} as never);
    return { agent, prisma };
  }

  it("adds each festival once and keeps a holiday the school already marked", async () => {
    const now = new Date('2026-12-01T06:00:00Z'); // Christmas 2026 .. Good Friday 2027 ahead
    const { agent, prisma } = make([day('2026-12-25')], day('2027-01-26'));
    const added = await agent.scan(now);
    const created = prisma.schoolBlockedDate.create.mock.calls.map((c) => c[0].data.note);
    expect(created).not.toContain('Christmas'); // applied before (school may have removed it)
    expect(created).not.toContain('Republic Day'); // school had its own holiday that day
    expect(created).toEqual(expect.arrayContaining(['Holi', 'Eid-ul-Fitr', 'Good Friday']));
    expect(added).toBe(created.length);
    // Every festival considered is recorded, so a removed one isn't re-added.
    expect(prisma.schoolFestivalApplied.create).toHaveBeenCalledTimes(created.length + 1);
  });
});
