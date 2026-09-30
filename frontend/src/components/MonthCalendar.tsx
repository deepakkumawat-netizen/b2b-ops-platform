import { ReactNode } from 'react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-05" for a local calendar day. */
export function isoDay(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** The local calendar day of a timestamp, as "2026-10-05". */
export function isoDayOf(iso: string): string {
  const d = new Date(iso);
  return isoDay(d.getFullYear(), d.getMonth(), d.getDate());
}

/** First and last day shown for a month, as "2026-10-01" / "2026-10-31". */
export function monthRange(month: { year: number; month: number }) {
  const last = new Date(month.year, month.month + 1, 0).getDate();
  return { from: isoDay(month.year, month.month, 1), to: isoDay(month.year, month.month, last) };
}

export type Month = { year: number; month: number };

export function currentMonth(): Month {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

// A plain month grid (weeks start Monday) shared by the staff calendar and
// the school's own calendar page. Each page decides what goes in a day.
export function MonthCalendar({
  month,
  onMonthChange,
  renderDay,
  dayClassName,
  onDayClick,
  today,
}: {
  month: Month;
  onMonthChange: (m: Month) => void;
  renderDay: (iso: string) => ReactNode;
  dayClassName?: (iso: string) => string;
  onDayClick?: (iso: string) => void;
  today: string;
}) {
  const first = new Date(month.year, month.month, 1);
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoDay(month.year, month.month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (by: number) => {
    const d = new Date(month.year, month.month + by, 1);
    onMonthChange({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="secondary" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
        <button className="secondary" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
        <button className="secondary cal-today" onClick={() => onMonthChange(currentMonth())}>
          Today
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="cal-weekday">
            {d}
          </div>
        ))}
        {cells.map((iso, i) =>
          iso ? (
            <div
              key={iso}
              className={`cal-day${iso === today ? ' today' : ''}${iso < today ? ' past' : ''}${onDayClick ? ' clickable' : ''} ${dayClassName?.(iso) ?? ''}`}
              onClick={onDayClick ? () => onDayClick(iso) : undefined}
            >
              <span className="cal-day-num">{Number(iso.slice(8))}</span>
              {renderDay(iso)}
            </div>
          ) : (
            <div key={`blank-${i}`} className="cal-day blank" />
          ),
        )}
      </div>
    </div>
  );
}
