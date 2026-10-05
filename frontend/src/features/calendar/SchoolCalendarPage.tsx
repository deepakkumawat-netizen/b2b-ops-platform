import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WorkshopStatus } from '@b2b-ops/shared';
import { api, SchoolCalendar } from '../../lib/api';
import { currentMonth, isoDayOf, Month, MonthCalendar } from '../../components/MonthCalendar';
import { Modal } from '../../components/Modal';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const longDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Public page (no login): the school's calendar from its emails. It shows
// the school's workshops and lets it mark holidays / busy days. The
// rescheduler agent never moves a workshop onto a marked day, and marking
// a day that already has a workshop alerts the account manager. It can
// also request a workshop, which emails the admins, manager and sales rep.
export function SchoolCalendarPage() {
  const { schoolId = '', token = '' } = useParams();
  const [data, setData] = useState<SchoolCalendar | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [month, setMonth] = useState<Month>(currentMonth);
  const [day, setDay] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [request, setRequest] = useState<{ topic: string; grades: string; date: string; time: string; note: string } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  function reload() {
    return api
      .getSchoolCalendar(schoolId, token)
      .then(setData)
      .catch((err) =>
        setLoadError(
          err instanceof Error && err.message === 'Not Found'
            ? 'This link is not valid. Please use the calendar link from your latest codevidhya email.'
            : "We couldn't load your calendar just now. Please try again in a minute.",
        ),
      );
  }

  useEffect(() => {
    reload();
  }, [schoolId, token]);

  if (!data) {
    return (
      <div className="auth-shell">
        <div className="public-form">
          <h1>Workshop calendar</h1>
          {loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading…</p>}
        </div>
      </div>
    );
  }

  const holidayOn = (iso: string) => data.holidays.find((h) => h.date === iso);
  const workshopsOn = (iso: string) => data.workshops.filter((w) => isoDayOf(w.scheduledAt) === iso);
  const selectedHoliday = day ? holidayOn(day) : undefined;
  const selectedWorkshops = day ? workshopsOn(day) : [];
  const upcoming = data.workshops.filter((w) => isoDayOf(w.scheduledAt) >= data.today && w.status !== WorkshopStatus.COMPLETED);

  function openDay(iso: string) {
    if (iso < data!.today) return;
    setDay(iso);
    setNote(holidayOn(iso)?.note ?? '');
    setMessage(null);
  }

  async function saveHoliday() {
    if (!day) return;
    setBusy(true);
    try {
      const { clashes } = await api.addSchoolHoliday(schoolId, token, day, note.trim() || undefined);
      await reload();
      setMessage(
        clashes.length
          ? {
              ok: false,
              text: `Saved. You have "${clashes[0].topic}" on ${longDay(day)}. Please use "Change date" on that workshop to pick a new day; we've let your account manager know.`,
            }
          : { ok: true, text: `Saved. We won't schedule a workshop on ${longDay(day)}.` },
      );
      setDay(null);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  function openRequest(date = '') {
    setDay(null);
    setMessage(null);
    setRequestError(null);
    setRequest({ topic: '', grades: '', date, time: '11:00', note: '' });
  }

  async function sendRequest() {
    if (!request) return;
    if (!request.topic.trim() || !request.date || !request.time) {
      setRequestError('Please fill in the topic, date and time.');
      return;
    }
    setBusy(true);
    setRequestError(null);
    try {
      await api.requestSchoolWorkshop(schoolId, token, {
        topic: request.topic.trim(),
        targetGrades: request.grades.trim() || undefined,
        date: request.date,
        time: request.time,
        note: request.note.trim() || undefined,
      });
      await reload();
      setMessage({ ok: true, text: `Thank you! We've received your workshop request for ${longDay(request.date)}. Our team will confirm it shortly.` });
      setRequest(null);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removeHoliday() {
    if (!day) return;
    setBusy(true);
    try {
      await api.removeSchoolHoliday(schoolId, token, day);
      await reload();
      setMessage({ ok: true, text: `${longDay(day)} is available again.` });
      setDay(null);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="public-form public-form-wide">
        <h1>Workshop calendar</h1>
        <p className="auth-subtitle">{data.schoolName} · codevidhya</p>
        <p className="muted small">
          Your workshops are shown in blue. Tap any day to mark it as a holiday, exam day or any day that doesn't suit you, and we'll never
          schedule a workshop on it. Want a workshop on a particular day? Use "Request a workshop".
        </p>
        {message && <div className={message.ok ? 'public-form-success' : 'warning'}>{message.text}</div>}
        <button onClick={() => openRequest()}>+ Request a workshop</button>

        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          today={data.today}
          onDayClick={openDay}
          dayClassName={(iso) => (holidayOn(iso) ? 'holiday' : '')}
          renderDay={(iso) => (
            <>
              {holidayOn(iso) && <span className="cal-chip holiday">🏖 {holidayOn(iso)!.note || 'Holiday'}</span>}
              {workshopsOn(iso).map((w) => (
                <span key={w.id} className={`cal-chip${w.status === WorkshopStatus.COMPLETED ? ' done' : w.schoolConfirmed ? ' ok' : ''}`}>
                  {time(w.scheduledAt)} {w.topic}
                </span>
              ))}
            </>
          )}
        />

        <h3>Upcoming workshops</h3>
        {upcoming.length === 0 ? (
          <p className="muted small">No upcoming workshops yet. They'll appear here as soon as we schedule them.</p>
        ) : (
          <ul className="cal-agenda">
            {upcoming.map((w) => (
              <li key={w.id} className="cal-agenda-row">
                <span className="cal-agenda-date">
                  {new Date(w.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, {time(w.scheduledAt)}
                </span>
                <span>
                  <strong>{w.topic}</strong>
                  {w.targetGrades ? ` (grades ${w.targetGrades})` : ''}
                  {w.schoolConfirmed && <span className="badge badge-success cal-confirmed">✓ Confirmed</span>}
                </span>
                {w.responsePath && (
                  <Link className="button-like secondary" to={w.responsePath}>
                    {w.schoolConfirmed ? 'Change date' : 'Confirm or change'}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {day && (
        <Modal
          title={longDay(day)}
          confirmLabel={busy ? 'Saving…' : selectedHoliday ? 'Update holiday' : 'Mark as holiday'}
          onConfirm={saveHoliday}
          onCancel={() => setDay(null)}
          confirmDisabled={busy}
        >
          {selectedWorkshops.map((w) => (
            <p key={w.id} className="small">
              📅 You have <strong>{w.topic}</strong> at {time(w.scheduledAt)} this day.
              {w.responsePath && (
                <>
                  {' '}
                  <Link to={w.responsePath}>Change its date</Link>
                </>
              )}
            </p>
          ))}
          <label>
            What's happening? (optional)
            <input placeholder="e.g. Diwali holiday, Exams" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          </label>
          {selectedHoliday ? (
            <button className="secondary" onClick={removeHoliday} disabled={busy}>
              Remove this holiday
            </button>
          ) : (
            <button className="secondary" onClick={() => openRequest(day)} disabled={busy}>
              Request a workshop on this day instead
            </button>
          )}
        </Modal>
      )}

      {request && (
        <Modal
          title="Request a workshop"
          confirmLabel={busy ? 'Sending…' : 'Send request'}
          onConfirm={sendRequest}
          onCancel={() => setRequest(null)}
          confirmDisabled={busy}
        >
          <p className="muted small">Pick a day and time that suits you. We'll confirm it by email.</p>
          <label>
            Topic
            <input
              placeholder="e.g. AI & Robotics workshop"
              value={request.topic}
              onChange={(e) => setRequest({ ...request, topic: e.target.value })}
              autoFocus
            />
          </label>
          <label>
            Grades (optional)
            <input placeholder="e.g. 6-8" value={request.grades} onChange={(e) => setRequest({ ...request, grades: e.target.value })} />
          </label>
          <label>
            Date
            <input type="date" min={data.today} value={request.date} onChange={(e) => setRequest({ ...request, date: e.target.value })} />
          </label>
          <label>
            Time
            <input type="time" value={request.time} onChange={(e) => setRequest({ ...request, time: e.target.value })} />
          </label>
          <label>
            Anything we should know? (optional)
            <textarea rows={3} value={request.note} onChange={(e) => setRequest({ ...request, note: e.target.value })} />
          </label>
          {requestError && <p className="error">{requestError}</p>}
        </Modal>
      )}
    </div>
  );
}
