import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SuggestionStatus } from '@b2b-ops/shared';
import { AgentSuggestion, api, staffToken, staffUser } from '../../lib/api';

export function AgentSuggestionsPage() {
  const token = staffToken.get()!;
  const isSuperAdmin = staffUser.get()?.role === 'SUPER_ADMIN';
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { draftSubject: string; draftBody: string }>>({});

  function reload() {
    api.listAgentSuggestions(token).then(setSuggestions).catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  function edited(s: AgentSuggestion) {
    return edits[s.id] ?? { draftSubject: s.draftSubject, draftBody: s.draftBody };
  }

  function setEdit(id: string, patch: Partial<{ draftSubject: string; draftBody: string }>) {
    setEdits((e) => ({ ...e, [id]: { ...edited(suggestions.find((s) => s.id === id)!), ...e[id], ...patch } }));
  }

  async function saveEdit(s: AgentSuggestion) {
    const change = edits[s.id];
    if (!change) return;
    try {
      await api.updateAgentSuggestion(s.id, change, token);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save edit');
    }
  }

  async function approve(s: AgentSuggestion) {
    try {
      if (edits[s.id]) await api.updateAgentSuggestion(s.id, edits[s.id], token);
      await api.approveAgentSuggestion(s.id, token);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve');
    }
  }

  async function reject(s: AgentSuggestion) {
    try {
      await api.rejectAgentSuggestion(s.id, token);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject');
    }
  }

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await api.runAgentsNow(token);
      setRunResult(`Created ${result.engagement} engagement + ${result.renewal} renewal suggestion(s).`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run agents');
    } finally {
      setRunning(false);
    }
  }

  const pending = suggestions.filter((s) => s.status === SuggestionStatus.PENDING);
  const decided = suggestions.filter((s) => s.status !== SuggestionStatus.PENDING);

  return (
    <div className="page">
      <div className="school-header">
        <h1>AI Suggestions</h1>
        {isSuperAdmin && (
          <button onClick={runNow} disabled={running}>
            {running ? 'Running…' : 'Run agents now'}
          </button>
        )}
      </div>
      {runResult && <p className="success">{runResult}</p>}
      {error && <p className="error">{error}</p>}

      <h2>Pending review</h2>
      {pending.length === 0 && <p className="muted">Nothing to review right now.</p>}
      <div className="workshop-list">
        {pending.map((s) => {
          const e = edited(s);
          return (
            <div key={s.id} className="card">
              <div className="workshop-header">
                <strong>
                  <Link to={`/schools/${s.schoolId}`}>{s.school.name}</Link> — {s.agentKey}
                </strong>
                <span className="badge">{s.suggestionType.replace(/_/g, ' ')}</span>
              </div>
              <p className="muted small">{s.reasoning}</p>
              <label>
                Subject
                <input value={e.draftSubject} onChange={(ev) => setEdit(s.id, { draftSubject: ev.target.value })} onBlur={() => saveEdit(s)} />
              </label>
              <label>
                Body
                <textarea
                  rows={6}
                  value={e.draftBody}
                  onChange={(ev) => setEdit(s.id, { draftBody: ev.target.value })}
                  onBlur={() => saveEdit(s)}
                />
              </label>
              <div className="button-row">
                <button onClick={() => approve(s)}>Approve &amp; Send</button>
                <button className="danger" onClick={() => reject(s)}>
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h2>Reviewed</h2>
      {decided.length === 0 && <p className="muted">Nothing reviewed yet.</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>School</th>
            <th>Agent</th>
            <th>Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {decided.map((s) => (
            <tr key={s.id}>
              <td>
                <Link to={`/schools/${s.schoolId}`}>{s.school.name}</Link>
              </td>
              <td>{s.agentKey}</td>
              <td>{s.suggestionType.replace(/_/g, ' ')}</td>
              <td>{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
