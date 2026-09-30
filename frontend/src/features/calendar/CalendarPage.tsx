import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkshopStatus } from '@b2b-ops/shared';
import { api, GoogleCalendarStatus, StaffCalendar } from '../../lib/api';
import { currentMonth, isoDayOf, Month, MonthCalendar, monthRange } from '../../components/MonthCalendar';

type Workshop = StaffCalendar['workshops'][number];

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function chipClass(w: Workshop) {
  if (w.status === WorkshopStatus.COMPLETED) return 'cal-chip done';
  if (w.changeRequested) return 'cal-chip warn';
  if (w.schoolConfirmed) return 'cal-chip ok';
  return 'cal-chip';
}

function chipLabel(w: Workshop) {
  if (w.status === WorkshopStatus.COMPLETED) return 'Completed';
  if (w.changeRequested) return 'School asked to change the date';
  if (w.schoolConfirmed) return 'Confirmed by the school';
  return 'Waiting for the school to confirm';
}

// Every school's workshops by date, plus the holidays schools marked on
// their own calendar links. Nobody edits it by hand: it reads the workshops
// themselves, so every move the rescheduler agent makes shows up here.
export function CalendarPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState<Month>(currentMonth);
  const [data, setData] = useState<StaffCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [google, setGoogle] = useState<GoogleCalendarStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  useEffect(() => {
    api.getGoogleCalendarStatus().then(setGoogle).catch(() => undefined);
  }, []);

  async function syncNow() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const result = await api.syncGoogleCalendar();
      setGoogle(result);
      setSyncNote(result.lastError ? null : `Synced ${result.synced} workshop(s) and holiday(s) to Google Calendar.`);
    } catch (err) {
      setSyncNote(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const { from, to } = monthRange(month);
    setError(null);
    // Ignore a slower answer for a month the user has already clicked past.
    let current = true;
    api
      .getStaffCalendar(from, to)
      .then((d) => current && setData(d))
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [month]);

  const schools = useMemo(() => {
    const names = new Map<string, string>();
    data?.workshops.forEach((w) => names.set(w.schoolId, w.schoolName));
    data?.holidays.forEach((h) => names.set(h.schoolId, h.schoolName));
    return [...names].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const workshops = (data?.workshops ?? []).filter((w) => !schoolFilter || w.schoolId === schoolFilter);
  const holidays = (data?.holidays ?? []).filter((h) => !schoolFilter || h.schoolId === schoolFilter);
  const now = new Date();
  const today = isoDayOf(now.toISOString());

  return (
    <div className="page">
      <h1>Calendar</h1>
      <p className="page-intro">Every school's workshops and holidays. The agents keep it up to date when schools confirm or move dates.</p>
      {google && (
        <div className={`gcal-card${google.configured && !google.lastError ? ' ok' : ''}`}>
          {google.configured ? (
            <>
              <span>
                <strong>{google.lastError ? '⚠ Google Calendar sync problem' : '✓ Connected to Google Calendar'}</strong>
                <span className="small muted">
                  {' '}
                  {google.lastError ??
                  `${google.myCalendar === 'own' ? 'Your schools’' : 'Every school’s'} workshops and holidays appear there automatically, and move when the agent moves them. Check your email for Google’s “calendar shared with you” invite.`}
                </span>
                {syncNote && <span className="small success"> {syncNote}</span>}
              </span>
              <span className="button-row">
                {google.openUrl ? (
                  <a className="button-like" href={google.openUrl} target="_blank" rel="noopener noreferrer">
                    Open my Google Calendar
                  </a>
                ) : (
                  <span className="small muted">Your Google Calendar is being prepared.</span>
                )}
                <button className="secondary" onClick={syncNow} disabled={syncing}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
              </span>
            </>
          ) : null}
          {google.configured && google.access && google.access.length > 0 && (
            <details className="gcal-access">
              <summary className="small">Who can see it in Google Calendar ({google.access.length} people)</summary>
              <table className="small">
                <tbody>
                  {google.access.map((a) => (
                    <tr key={a.email}>
                      <td>{a.name}</td>
                      <td className="muted">{a.role.replace('_', ' ')}</td>
                      <td className="muted">{a.email}</td>
                      <td>{a.error ? <span className="error">⚠ {a.error}</span> : a.access === 'none' ? 'No access' : `✓ ${a.access}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          {!google.configured && (
            <span className="small muted">
              <strong>Google Calendar is not connected yet.</strong> Once an admin sets it up, every workshop and school holiday also appears in
              Google Calendar automatically.
            </span>
          )}
        </div>
      )}

      <div className="cal-toolbar">
        <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} aria-label="Filter by school">
          <option value="">All schools</option>
          {schools.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="cal-legend small">
        <span className="cal-chip">Waiting for school</span>
        <span className="cal-chip ok">Confirmed</span>
        <span className="cal-chip warn">Change requested</span>
        <span className="cal-chip done">Completed</span>
        <span className="cal-chip holiday">School holiday</span>
      </div>

      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        today={today}
        renderDay={(iso) => (
          <>
            {holidays
              .filter((h) => h.date === iso)
              .map((h) => (
                <span key={h.schoolId} className="cal-chip holiday" title={`${h.schoolName} holiday${h.note ? `: ${h.note}` : ''}`}>
                  🏖 {h.schoolName}
                  {h.note ? `: ${h.note}` : ''}
                </span>
              ))}
            {workshops
              .filter((w) => isoDayOf(w.scheduledAt) === iso)
              .map((w) => (
                <button
                  key={w.id}
                  className={chipClass(w)}
                  title={`${w.schoolName}: ${w.topic} at ${time(w.scheduledAt)}. ${chipLabel(w)}`}
                  onClick={() => navigate(`/schools/${w.schoolId}?tab=Workshops`)}
                >
                  {time(w.scheduledAt)} {w.schoolName}: {w.topic}
                </button>
              ))}
          </>
        )}
      />

      <h3>This month</h3>
      {workshops.length === 0 ? (
        <p className="muted">No workshops this month.</p>
      ) : (
        <ul className="cal-agenda">
          {workshops.map((w) => (
            <li key={w.id}>
              <button className="cal-agenda-item" onClick={() => navigate(`/schools/${w.schoolId}?tab=Workshops`)}>
                <span className="cal-agenda-date">
                  {new Date(w.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, {time(w.scheduledAt)}
                </span>
                <span>
                  <strong>{w.schoolName}</strong>: {w.topic}
                  {w.targetGrades ? ` (grades ${w.targetGrades})` : ''}
                </span>
                <span className={chipClass(w)}>{chipLabel(w)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
