import { useEffect, useState } from 'react';
import { api, GoogleCalendarStatus } from '../../lib/api';

// The workshop calendar is Google Calendar itself, shown right here: the
// agents keep it in step with every workshop and school holiday, so there's
// one calendar for everyone (an account manager sees only their schools').
export function CalendarPage() {
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

  return (
    <div className="page">
      <h1>Calendar</h1>
      <p className="page-intro">Every school's workshops and holidays in Google Calendar. The agents keep it up to date when schools confirm or move dates.</p>
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
                {google.addUrl && (
                  <a className="small" href={google.addUrl} target="_blank" rel="noopener noreferrer">
                    First time? Add it to Google Calendar
                  </a>
                )}
                {google.openUrl && google.googleAccount && <span className="small muted">Opens as {google.googleAccount}</span>}
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


      {google?.embedUrl && (
        <>
          <iframe className="gcal-embed" src={google.embedUrl} title="Workshop calendar (Google Calendar)" />
          <p className="small muted">
            Empty calendar? Sign in to {google.googleAccount ?? 'your Google account'} in this browser, and click “First time? Add it to Google
            Calendar” once.
          </p>
        </>
      )}
    </div>
  );
}
