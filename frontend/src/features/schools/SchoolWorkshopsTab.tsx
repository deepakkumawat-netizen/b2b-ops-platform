import { FormEvent, useEffect, useState } from 'react';
import { WorkshopStatus } from '@b2b-ops/shared';
import { api, Workshop } from '../../lib/api';

const STATUS_BADGE_CLASS: Record<string, string> = {
  [WorkshopStatus.SCHEDULED]: 'badge badge-muted',
  [WorkshopStatus.CONFIRMED]: 'badge',
  [WorkshopStatus.COMPLETED]: 'badge badge-success',
  [WorkshopStatus.CANCELLED]: 'badge badge-danger',
  [WorkshopStatus.RESCHEDULED]: 'badge badge-warning',
};

export function SchoolWorkshopsTab({ schoolId, token }: { schoolId: string; token: string }) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [form, setForm] = useState({ topic: '', targetGrades: '', scheduledAt: '' });
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listWorkshops(schoolId, token).then(setWorkshops).catch((err) => setError(err.message));
  }

  useEffect(reload, [schoolId]);

  async function createWorkshop(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createWorkshop(schoolId, { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() }, token);
      setForm({ topic: '', targetGrades: '', scheduledAt: '' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule workshop');
    }
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      <div className="workshop-list">
        {workshops.map((w) => (
          <div key={w.id} className="card">
            <div className="workshop-header">
              <strong>{w.topic}</strong>
              <span className={STATUS_BADGE_CLASS[w.status]}>{w.status}</span>
            </div>
            <p className="muted">
              {new Date(w.scheduledAt).toLocaleString()} {w.targetGrades ? `· Grades ${w.targetGrades}` : ''}
            </p>
            <p className="small muted">
              {w.confirmationSentAt ? '✓ Confirmation sent' : 'Not confirmed'} ·{' '}
              {w.reminderSentAt ? '✓ Reminder sent' : 'No reminder yet'} ·{' '}
              {w.feedbackReceivedAt ? '✓ Feedback received' : 'No feedback yet'}
            </p>
            {w.cancelReason && <p className="error small">Cancelled: {w.cancelReason}</p>}
            <div className="button-row">
              {w.status === WorkshopStatus.SCHEDULED && (
                <button onClick={() => run(() => api.confirmWorkshop(schoolId, w.id, token))}>Confirm</button>
              )}
              {w.status === WorkshopStatus.CONFIRMED && (
                <>
                  <button onClick={() => run(() => api.remindWorkshop(schoolId, w.id, token))}>Send Reminder</button>
                  <button onClick={() => run(() => api.completeWorkshop(schoolId, w.id, token))}>Mark Completed</button>
                </>
              )}
              {(w.status === WorkshopStatus.SCHEDULED || w.status === WorkshopStatus.CONFIRMED) && (
                <button
                  className="danger"
                  onClick={() => {
                    const reason = prompt('Cancellation reason?');
                    if (reason) run(() => api.cancelWorkshop(schoolId, w.id, reason, token));
                  }}
                >
                  Cancel
                </button>
              )}
              {w.status === WorkshopStatus.COMPLETED && !w.feedbackReceivedAt && (
                <button
                  onClick={() => {
                    const summary = prompt('Feedback summary?');
                    if (summary) run(() => api.recordWorkshopFeedback(schoolId, w.id, summary, token));
                  }}
                >
                  Record Feedback
                </button>
              )}
            </div>
            {w.feedbackSummary && <p className="small">Feedback: {w.feedbackSummary}</p>}
          </div>
        ))}
        {workshops.length === 0 && <p className="muted">No workshops scheduled yet.</p>}
      </div>

      <h3>Schedule a workshop</h3>
      <form className="form-row" onSubmit={createWorkshop}>
        <input placeholder="Topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required />
        <input
          placeholder="Target grades"
          value={form.targetGrades}
          onChange={(e) => setForm({ ...form, targetGrades: e.target.value })}
        />
        <input
          type="datetime-local"
          value={form.scheduledAt}
          onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          required
        />
        <button type="submit">Schedule</button>
      </form>
    </div>
  );
}
