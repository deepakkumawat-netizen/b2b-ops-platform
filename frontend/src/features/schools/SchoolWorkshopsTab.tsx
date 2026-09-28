import { FormEvent, useEffect, useState } from 'react';
import { WorkshopStatus } from '@b2b-ops/shared';
import { api, Workshop } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { CalendarIcon } from '../../components/icons';
import { Modal } from '../../components/Modal';

type DialogState = { type: 'cancel' | 'feedback'; workshopId: string };
type EmailSentField = 'confirmationSentAt' | 'reminderSentAt' | 'feedbackFormSentAt';

const STATUS_BADGE_CLASS: Record<string, string> = {
  [WorkshopStatus.SCHEDULED]: 'badge badge-muted',
  [WorkshopStatus.CONFIRMED]: 'badge',
  [WorkshopStatus.COMPLETED]: 'badge badge-success',
  [WorkshopStatus.CANCELLED]: 'badge badge-danger',
  [WorkshopStatus.RESCHEDULED]: 'badge badge-warning',
};

export function SchoolWorkshopsTab({ schoolId }: { schoolId: string }) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [form, setForm] = useState({ topic: '', targetGrades: '', scheduledAt: '' });
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogText, setDialogText] = useState('');

  function reload() {
    api.listWorkshops(schoolId).then(setWorkshops).catch((err) => setError(err.message));
  }

  useEffect(reload, [schoolId]);

  async function createWorkshop(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createWorkshop(schoolId, { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() });
      setForm({ topic: '', targetGrades: '', scheduledAt: '' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule workshop');
    }
  }

  async function run(action: () => Promise<unknown>) {
    setWarning(null);
    try {
      await action();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  // For the steps that email the school: the backend only stamps the
  // *SentAt field when the email actually went out, so a null one on the
  // returned workshop means it was skipped or failed.
  function runEmailStep(action: () => Promise<Workshop>, sentField: EmailSentField, emailName: string) {
    return run(async () => {
      const result = await action();
      if (!result[sentField]) {
        setWarning(`The ${emailName} email wasn't sent. Check the Activity tab → Emails for the reason, then try again.`);
      }
    });
  }

  function openDialog(type: DialogState['type'], workshopId: string) {
    setDialog({ type, workshopId });
    setDialogText('');
  }

  function confirmDialog() {
    if (!dialog) return;
    const text = dialogText.trim();
    if (!text) return;
    const { type, workshopId } = dialog;
    setDialog(null);
    if (type === 'cancel') {
      run(() => api.cancelWorkshop(schoolId, workshopId, text));
    } else {
      run(() => api.recordWorkshopFeedback(schoolId, workshopId, text));
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {warning && <p className="warning">{warning}</p>}
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
              {w.confirmationSentAt
                ? '✓ Confirmation sent'
                : w.status === WorkshopStatus.SCHEDULED || w.status === WorkshopStatus.CANCELLED
                  ? 'Not confirmed'
                  : '⚠ Confirmation email not sent'}{' '}
              · {w.reminderSentAt ? '✓ Reminder sent' : 'No reminder yet'}
              {w.status === WorkshopStatus.COMPLETED && !w.feedbackFormSentAt && ' · ⚠ Thank-you email not sent'} ·{' '}
              {w.feedbackReceivedAt ? '✓ Feedback received' : 'No feedback yet'}
            </p>
            {w.cancelReason && <p className="error small">Cancelled: {w.cancelReason}</p>}
            <div className="button-row">
              {w.status === WorkshopStatus.SCHEDULED && (
                <button onClick={() => runEmailStep(() => api.confirmWorkshop(schoolId, w.id), 'confirmationSentAt', 'confirmation')}>
                  Confirm
                </button>
              )}
              {w.status === WorkshopStatus.CONFIRMED && (
                <>
                  {!w.confirmationSentAt && (
                    <button
                      className="secondary"
                      onClick={() => runEmailStep(() => api.confirmWorkshop(schoolId, w.id), 'confirmationSentAt', 'confirmation')}
                    >
                      Resend Confirmation
                    </button>
                  )}
                  <button onClick={() => runEmailStep(() => api.remindWorkshop(schoolId, w.id), 'reminderSentAt', 'reminder')}>
                    Send Reminder
                  </button>
                  <button onClick={() => runEmailStep(() => api.completeWorkshop(schoolId, w.id), 'feedbackFormSentAt', 'thank-you')}>
                    Mark Completed
                  </button>
                </>
              )}
              {w.status === WorkshopStatus.COMPLETED && !w.feedbackFormSentAt && (
                <button
                  className="secondary"
                  onClick={() => runEmailStep(() => api.completeWorkshop(schoolId, w.id), 'feedbackFormSentAt', 'thank-you')}
                >
                  Resend Thank-you Email
                </button>
              )}
              {(w.status === WorkshopStatus.SCHEDULED || w.status === WorkshopStatus.CONFIRMED) && (
                <button className="danger" onClick={() => openDialog('cancel', w.id)}>
                  Cancel
                </button>
              )}
              {w.status === WorkshopStatus.COMPLETED && !w.feedbackReceivedAt && (
                <button onClick={() => openDialog('feedback', w.id)}>Record Feedback</button>
              )}
            </div>
            {w.feedbackSummary && <p className="small">Feedback: {w.feedbackSummary}</p>}
          </div>
        ))}
        {workshops.length === 0 && (
          <EmptyState
            icon={<CalendarIcon width={22} height={22} />}
            title="No workshops scheduled yet"
            text="Use the form below to schedule the first student workshop for this school."
          />
        )}
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

      {dialog && (
        <Modal
          title={dialog.type === 'cancel' ? 'Cancel workshop' : 'Record feedback'}
          confirmLabel={dialog.type === 'cancel' ? 'Cancel workshop' : 'Save feedback'}
          onConfirm={confirmDialog}
          onCancel={() => setDialog(null)}
          confirmDisabled={!dialogText.trim()}
        >
          <label>
            {dialog.type === 'cancel' ? 'Cancellation reason' : 'Feedback summary'}
            <textarea rows={3} value={dialogText} onChange={(e) => setDialogText(e.target.value)} autoFocus />
          </label>
        </Modal>
      )}
    </div>
  );
}
