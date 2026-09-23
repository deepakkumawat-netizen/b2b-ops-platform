import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SuggestionStatus } from '@b2b-ops/shared';
import { AgentSuggestion, api, staffToken, staffUser } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { SparkleIcon } from '../../components/icons';
import { SkeletonTableRows } from '../../components/Skeleton';

const STATUS_BADGE_CLASS: Record<string, string> = {
  [SuggestionStatus.PENDING]: 'badge badge-warning',
  [SuggestionStatus.SENT]: 'badge badge-success',
  [SuggestionStatus.REJECTED]: 'badge badge-danger',
  [SuggestionStatus.APPROVED]: 'badge',
  [SuggestionStatus.AUTO_SENT]: 'badge badge-info',
};

const STATUS_LABEL: Record<string, string> = {
  [SuggestionStatus.PENDING]: 'Pending',
  [SuggestionStatus.SENT]: 'Sent',
  [SuggestionStatus.REJECTED]: 'Rejected',
  [SuggestionStatus.APPROVED]: 'Approved',
  [SuggestionStatus.AUTO_SENT]: 'Auto-sent',
};

export function AgentSuggestionsPage() {
  const token = staffToken.get()!;
  const isSuperAdmin = staffUser.get()?.role === 'SUPER_ADMIN';
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { draftSubject: string; draftBody: string }>>({});
  const [sortKey, setSortKey] = useState<'school' | 'agent' | 'type' | 'status'>('school');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function reload() {
    setLoading(true);
    api
      .listAgentSuggestions(token)
      .then(setSuggestions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  function toggleSort(key: typeof sortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

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
      const alerts = result.stalePhase + result.renewalStalled + result.competitionFollowup + result.dataCompleteness;
      setRunResult(
        `Drafted ${result.engagement} engagement + ${result.renewal} renewal suggestion(s) for review. ` +
          `Auto-sent ${result.workshopReminder} workshop reminder(s), ${result.workshopFeedbackNag} feedback nag(s), ` +
          `and opened ${result.renewalCycleOpener} renewal cycle(s) automatically. ` +
          `Logged ${alerts} internal alert(s) (stale phase, stalled renewal, competition follow-up, missing data).`,
      );
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run agents');
    } finally {
      setRunning(false);
    }
  }

  const pending = suggestions.filter((s) => s.status === SuggestionStatus.PENDING);
  const decided = suggestions.filter((s) => s.status !== SuggestionStatus.PENDING);

  const sortAccessor: Record<typeof sortKey, (s: AgentSuggestion) => string> = {
    school: (s) => s.school.name.toLowerCase(),
    agent: (s) => s.agentKey.toLowerCase(),
    type: (s) => s.suggestionType,
    status: (s) => s.status,
  };
  const sortedDecided = useMemo(() => {
    const accessor = sortAccessor[sortKey];
    return [...decided].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decided, sortKey, sortDir]);

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
      <p className="page-intro">
        Follow-up nudges and renewal pitches land below for you to edit and approve before anything sends. Workshop
        day-before reminders and opening a renewal cycle happen automatically — you'll see those in Activity marked{' '}
        <span className="badge badge-info">Auto-sent</span>.
      </p>
      {runResult && <p className="success">{runResult}</p>}
      {error && <p className="error">{error}</p>}

      <h2>Pending review</h2>
      {!loading && pending.length === 0 && (
        <EmptyState
          icon={<SparkleIcon width={22} height={22} />}
          title="Nothing to review right now"
          text={isSuperAdmin ? 'Click "Run agents now" above to check for schools that need a nudge.' : 'Check back later — the AI agents run automatically.'}
        />
      )}
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

      <h2>Activity</h2>
      <p className="muted small" style={{ marginTop: -4 }}>
        Everything the agents have drafted, sent, or done automatically.
      </p>
      {!loading && decided.length === 0 && <p className="muted">Nothing yet.</p>}
      {(loading || decided.length > 0) && (
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort('school')}>
                School{sortKey === 'school' && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
              <th className="sortable" onClick={() => toggleSort('agent')}>
                Agent{sortKey === 'agent' && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
              <th className="sortable" onClick={() => toggleSort('type')}>
                Type{sortKey === 'type' && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
              <th className="sortable" onClick={() => toggleSort('status')}>
                Status{sortKey === 'status' && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={4} columns={4} />
            ) : (
              sortedDecided.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/schools/${s.schoolId}`}>{s.school.name}</Link>
                  </td>
                  <td>{s.agentKey}</td>
                  <td>{s.suggestionType.replace(/_/g, ' ')}</td>
                  <td>
                    <span className={STATUS_BADGE_CLASS[s.status]}>{STATUS_LABEL[s.status]}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
