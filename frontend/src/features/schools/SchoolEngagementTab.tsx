import { FormEvent, useEffect, useState } from 'react';
import { EngagementType } from '@b2b-ops/shared';
import { api, EngagementLog } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { CalendarIcon } from '../../components/icons';

const TYPE_LABEL: Record<string, string> = {
  [EngagementType.MONTHLY_VISIT]: 'Monthly Visit',
  [EngagementType.WEEKLY_CALL]: 'Weekly Call',
};

export function SchoolEngagementTab({ schoolId, token }: { schoolId: string; token: string }) {
  const [logs, setLogs] = useState<EngagementLog[]>([]);
  const [form, setForm] = useState<{ type: EngagementType; date: string; summary: string; issuesRaised: string }>({
    type: EngagementType.MONTHLY_VISIT,
    date: '',
    summary: '',
    issuesRaised: '',
  });
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listEngagementLogs(schoolId, token).then(setLogs).catch((err) => setError(err.message));
  }

  useEffect(reload, [schoolId]);

  async function addLog(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createEngagementLog(schoolId, { ...form, date: new Date(form.date).toISOString() }, token);
      setForm({ type: EngagementType.MONTHLY_VISIT, date: '', summary: '', issuesRaised: '' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log engagement');
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {logs.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon width={22} height={22} />}
          title="No visits or calls logged yet"
          text="Use the form below to log the first monthly visit or weekly check-in call."
        />
      ) : (
        <div className="workshop-list">
          {logs.map((l) => (
            <div key={l.id} className="card">
              <div className="workshop-header">
                <strong>{TYPE_LABEL[l.type] ?? l.type.replace(/_/g, ' ')}</strong>
                <span className="badge badge-muted">{new Date(l.date).toLocaleDateString()}</span>
              </div>
              <p className="muted small">Conducted by {l.conductedByStaff?.name ?? 'Unknown'}</p>
              {l.summary && <p className="small">{l.summary}</p>}
              {l.issuesRaised && <p className="error small">Issue raised: {l.issuesRaised}</p>}
            </div>
          ))}
        </div>
      )}

      <h3>Log a visit or call</h3>
      <form className="form-row" onSubmit={addLog}>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as EngagementType })}>
          <option value={EngagementType.MONTHLY_VISIT}>Monthly Visit</option>
          <option value={EngagementType.WEEKLY_CALL}>Weekly Call</option>
        </select>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <input placeholder="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        <input
          placeholder="Issues raised"
          value={form.issuesRaised}
          onChange={(e) => setForm({ ...form, issuesRaised: e.target.value })}
        />
        <button type="submit">Log</button>
      </form>
    </div>
  );
}
