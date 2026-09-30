import { useEffect, useState } from 'react';
import { api, GoogleCalendarStatus } from '../../lib/api';

// The workshop calendar is Google Calendar itself, shown right here: the
// agents keep it in step with every workshop and school holiday, so there's
// one calendar for everyone (an account manager sees only their schools').
export function CalendarPage() {
  const [google, setGoogle] = useState<GoogleCalendarStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGoogleCalendarStatus()
      .then(setGoogle)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the calendar'));
  }, []);

  return (
    <div className="page">
      <h1>Calendar</h1>
      <p className="page-intro">Every school's workshops and holidays. The agents keep it up to date when schools confirm or move dates.</p>
      {error && <p className="error">{error}</p>}
      {google && !google.configured && <p className="muted">Google Calendar is not connected yet.</p>}
      {google?.configured && !google.embedUrl && <p className="muted">Your calendar is being prepared. Please check again in a few minutes.</p>}
      {google?.embedUrl && (
        <>
          <iframe className="gcal-embed" src={google.embedUrl} title="Workshop calendar (Google Calendar)" />
          <p className="small muted">Calendar empty or asking you to sign in? Sign in to {google.googleAccount ?? 'your Google account'} in this browser.</p>
        </>
      )}
    </div>
  );
}
