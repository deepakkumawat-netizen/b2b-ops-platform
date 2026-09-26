import { formatInZone, startOfDayInZone, yearInZone } from './time';

// The server runs on UTC; the business runs on IST (UTC+5:30). These pin the
// exact boundaries the workshop-reminder agent relies on.
describe('time helpers (Asia/Kolkata)', () => {
  const tz = 'Asia/Kolkata';

  it('returns IST midnight, not UTC midnight', () => {
    // 10:00 IST on 26 Sep 2026
    const now = new Date('2026-09-26T04:30:00Z');
    expect(startOfDayInZone(now, 0, tz).toISOString()).toBe('2026-09-25T18:30:00.000Z');
    expect(startOfDayInZone(now, 1, tz).toISOString()).toBe('2026-09-26T18:30:00.000Z');
  });

  it('treats 01:00 IST as the new day even though it is still yesterday in UTC', () => {
    const now = new Date('2026-09-25T19:30:00Z'); // 01:00 IST on 26 Sep
    expect(startOfDayInZone(now, 0, tz).toISOString()).toBe('2026-09-25T18:30:00.000Z');
  });

  it('rolls over months and years', () => {
    const now = new Date('2026-12-31T12:00:00Z');
    expect(startOfDayInZone(now, 1, tz).toISOString()).toBe('2026-12-31T18:30:00.000Z');
  });

  it('reports the IST year around New Year', () => {
    expect(yearInZone(new Date('2026-12-31T19:00:00Z'), tz)).toBe(2027);
    expect(yearInZone(new Date('2026-12-31T18:00:00Z'), tz)).toBe(2026);
  });

  it('formats times in IST for emails', () => {
    expect(formatInZone(new Date('2026-09-26T04:30:00Z'), tz)).toMatch(/10:00/);
  });
});
