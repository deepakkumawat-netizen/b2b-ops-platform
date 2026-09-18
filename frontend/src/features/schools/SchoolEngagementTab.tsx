import { FormEvent, useEffect, useState } from 'react';
import { EngagementType } from '@b2b-ops/shared';
import { api, EngagementLog } from '../../lib/api';

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
      <table className="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Date</th>
            <th>Conducted By</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.type.replace(/_/g, ' ')}</td>
              <td>{new Date(l.date).toLocaleDateString()}</td>
              <td>{l.conductedByStaff?.name ?? '—'}</td>
              <td>{l.summary ?? '—'}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No visits or calls logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
