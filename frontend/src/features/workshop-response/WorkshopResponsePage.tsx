import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, WorkshopResponseInfo } from '../../lib/api';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const OUTCOME_TEXT: Record<string, string> = {
  rescheduled: 'Done! Your workshop has been moved. We have emailed you the new date.',
  asked_again: "We couldn't use those dates, as another workshop may already be on that day. We have emailed you; please pick different dates below.",
  needs_manager: 'Thank you. Your account manager will call you to agree a new date.',
  nothing: 'Thank you. We have your request and will email you the new date shortly.',
};

// Public page (no login): the link in a school's workshop confirmation and
// reschedule emails. The school confirms the date, or asks for a change
// with one or two preferred dates; the workshop rescheduler agent then moves
// the workshop straight away and emails the school and its manager.
export function WorkshopResponsePage() {
  const { workshopId = '', token = '' } = useParams();
  const [info, setInfo] = useState<WorkshopResponseInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [form, setForm] = useState({ reason: '', date1: '', date2: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .getWorkshopResponse(workshopId, token)
      .then(setInfo)
      .catch((err) =>
        setLoadError(
          err instanceof Error && err.message === 'Not Found'
            ? 'This link is no longer valid. The workshop may have been removed. Please use the link in your latest codevidhya email, or reply to that email.'
            : "We couldn't load this page just now. Please try again in a minute.",
        ),
      );
  }, [workshopId, token]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      setInfo(await api.confirmWorkshopDate(workshopId, token));
      setMessage('Thank you for confirming. See you at the workshop!');
      setChanging(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function requestChange(e: FormEvent) {
    e.preventDefault();
    const preferredDates = [form.date1, form.date2].filter(Boolean);
    if (preferredDates.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.requestWorkshopChange(workshopId, token, { reason: form.reason.trim() || undefined, preferredDates });
      setInfo(result);
      setMessage(OUTCOME_TEXT[result.outcome ?? 'nothing']);
      setChanging(result.outcome === 'asked_again');
      setForm({ reason: form.reason, date1: '', date2: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!info) {
    return (
      <div className="auth-shell">
        <div className="public-form">
          <h1>Workshop date</h1>
          {loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading…</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="public-form">
        <h1>Workshop date</h1>
        <p className="auth-subtitle">{info.schoolName} · codevidhya</p>

        <section className="school-part">
          <strong>{info.topic}</strong>
          {info.targetGrades && <p className="muted small">Grades {info.targetGrades}</p>}
          <p className="workshop-response-date">{when(info.scheduledAt)}</p>
          {info.schoolConfirmedAt && <span className="badge badge-success">✓ You confirmed this date</span>}
        </section>

        {message && <div className="public-form-success">{message}</div>}
        {error && <p className="error">{error}</p>}

        {!info.live ? (
          <p className="muted">This workshop is {info.status.toLowerCase()}, so its date can't be changed here any more.</p>
        ) : (
          <>
            {!changing && (
              <div className="button-row">
                {!info.schoolConfirmedAt && (
                  <button onClick={confirm} disabled={busy}>
                    {busy ? 'Saving…' : 'Yes, this date works'}
                  </button>
                )}
                <button className="secondary" onClick={() => setChanging(true)} disabled={busy}>
                  Please change the date
                </button>
              </div>
            )}

            {changing && (
              <form onSubmit={requestChange} className="workshop-response-form">
                <p className="muted small">
                  Pick one or two days that suit you. We keep the same time of day and move the workshop straight away.
                </p>
                <div className="school-part-grid">
                  <label>
                    Preferred date *
                    <input type="date" min={info.earliestDate} value={form.date1} onChange={(e) => setForm({ ...form, date1: e.target.value })} required />
                  </label>
                  <label>
                    Second choice (optional)
                    <input type="date" min={info.earliestDate} value={form.date2} onChange={(e) => setForm({ ...form, date2: e.target.value })} />
                  </label>
                </div>
                <label>
                  Reason (optional)
                  <textarea rows={2} placeholder="e.g. Exams that week" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </label>
                <div className="button-row">
                  <button type="submit" disabled={busy || !form.date1}>
                    {busy ? 'Moving the workshop…' : 'Move my workshop'}
                  </button>
                  <button type="button" className="secondary" onClick={() => setChanging(false)} disabled={busy}>
                    Back
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
