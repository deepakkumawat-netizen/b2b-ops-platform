import { FormEvent, useEffect, useState } from 'react';
import { RenewalStatus } from '@b2b-ops/shared';
import { api, RenewalCycle, YearSummary } from '../../lib/api';

export function SchoolRenewalsTab({ schoolId, token }: { schoolId: string; token: string }) {
  const [cycles, setCycles] = useState<RenewalCycle[]>([]);
  const [summary, setSummary] = useState<YearSummary | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listRenewals(schoolId, token).then(setCycles).catch((err) => setError(err.message));
    api.getRenewalYearSummary(schoolId, token).then(setSummary).catch((err) => setError(err.message));
  }

  useEffect(reload, [schoolId]);

  async function createCycle(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createRenewal(schoolId, newLabel, token);
      setNewLabel('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create renewal cycle');
    }
  }

  async function updateCycle(cycle: RenewalCycle, patch: Partial<RenewalCycle>) {
    try {
      await api.updateRenewal(schoolId, cycle.id, patch, token);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {summary && (
        <section className="card">
          <h2>Year Summary (partnership-to-date)</h2>
          <ul className="phase-breakdown">
            <li>
              <span>Workshops completed</span>
              <strong>
                {summary.workshopsCompleted} / {summary.workshopsTotal}
              </strong>
            </li>
            <li>
              <span>Competitions</span>
              <strong>{summary.competitionsCount}</strong>
            </li>
            <li>
              <span>Certificates issued</span>
              <strong>{summary.certificatesIssuedCount}</strong>
            </li>
            <li>
              <span>Monthly visits</span>
              <strong>{summary.monthlyVisitsCount}</strong>
            </li>
            <li>
              <span>Weekly calls</span>
              <strong>{summary.weeklyCallsCount}</strong>
            </li>
          </ul>
        </section>
      )}

      {cycles.map((c) => (
        <div key={c.id} className="card">
          <div className="workshop-header">
            <strong>{c.cycleLabel}</strong>
            <span className="badge">{c.renewalStatus}</span>
          </div>
          <label>
            Feedback call date
            <input
              type="date"
              value={c.feedbackCallDate ? c.feedbackCallDate.slice(0, 10) : ''}
              onChange={(e) => updateCycle(c, { feedbackCallDate: new Date(e.target.value).toISOString() })}
            />
          </label>
          <label>
            Feedback summary
            <textarea
              defaultValue={c.feedbackSummary ?? ''}
              onBlur={(e) => updateCycle(c, { feedbackSummary: e.target.value })}
            />
          </label>
          <label>
            Renewal status
            <select value={c.renewalStatus} onChange={(e) => updateCycle(c, { renewalStatus: e.target.value as RenewalStatus })}>
              {Object.values(RenewalStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
      {cycles.length === 0 && <p className="muted">No renewal cycle opened yet.</p>}

      <h3>Open a renewal cycle</h3>
      <form className="form-row" onSubmit={createCycle}>
        <input
          placeholder="e.g. 2026-27"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          required
        />
        <button type="submit">Open</button>
      </form>
    </div>
  );
}
