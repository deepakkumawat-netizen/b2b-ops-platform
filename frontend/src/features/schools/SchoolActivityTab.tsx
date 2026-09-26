import { useEffect, useState } from 'react';
import { ActivityEntry, api } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { InboxIcon } from '../../components/icons';
import { SkeletonCard } from '../../components/Skeleton';

const FILTERS: { key: ActivityEntry['kind'] | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTION', label: 'Team actions' },
  { key: 'EMAIL', label: 'Emails' },
  { key: 'AGENT', label: 'AI agents' },
  { key: 'ENGAGEMENT', label: 'Visits & calls' },
];

// "Who did what, when" for one school — human actions, every email attempt,
// AI agent activity and logged visits/calls in one newest-first timeline.
export function SchoolActivityTab({ schoolId }: { schoolId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('ALL');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listSchoolActivity(schoolId).then(setEntries).catch((err) => setError(err.message));
  }, [schoolId]);

  if (error) return <p className="error">{error}</p>;
  if (!entries) return <SkeletonCard lines={5} />;

  const shown = filter === 'ALL' ? entries : entries.filter((e) => e.kind === filter);

  return (
    <div>
      <div className="activity-filters">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={filter === f.key ? '' : 'secondary'} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState
          icon={<InboxIcon width={24} height={24} />}
          title="Nothing here yet"
          text="Phase changes, checklist updates, emails and agent actions for this school will appear here."
        />
      ) : (
        <ul className="activity-list">
          {shown.map((e) => (
            <li key={e.id} className={`activity-item kind-${e.kind}`}>
              <div className="activity-title">{e.title}</div>
              <div className="activity-meta">
                {new Date(e.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                {e.actor ? ` · ${e.actor}` : ''}
              </div>
              {e.detail && <div className="activity-detail">{e.detail}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
