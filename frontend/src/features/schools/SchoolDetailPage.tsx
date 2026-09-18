import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, School, staffToken } from '../../lib/api';
import { SchoolChecklistTab } from './SchoolChecklistTab';
import { SchoolTeachersTab } from './SchoolTeachersTab';
import { SchoolInfraTab } from './SchoolInfraTab';
import { SchoolWorkshopsTab } from './SchoolWorkshopsTab';
import { SchoolEngagementTab } from './SchoolEngagementTab';
import { SchoolCompetitionsTab } from './SchoolCompetitionsTab';
import { SchoolRenewalsTab } from './SchoolRenewalsTab';

const TABS = ['Checklist', 'Teachers', 'Infra', 'Workshops', 'Engagement', 'Competitions', 'Renewal'] as const;
type Tab = (typeof TABS)[number];

export function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = staffToken.get()!;
  const [school, setSchool] = useState<School | null>(null);
  const [tab, setTab] = useState<Tab>('Checklist');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function reload() {
    if (!id) return;
    api.getSchool(id, token).then(setSchool).catch((err) => setError(err.message));
  }

  useEffect(reload, [id]);

  async function advancePhase() {
    if (!id) return;
    setWarning(null);
    try {
      const result = await api.advanceSchoolPhase(id, token);
      setSchool(result.school);
      if (result.warning) setWarning(result.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not advance phase');
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!school || !id) return <p>Loading…</p>;

  return (
    <div className="page">
      <div className="school-header">
        <div>
          <h1>{school.name}</h1>
          <p className="muted">
            {school.city ?? '—'}
            {school.state ? `, ${school.state}` : ''} · {school.productProgram ?? 'No program on file'}
          </p>
        </div>
        <div className="school-header-phase">
          <span className="badge">{school.currentPhase.replace(/_/g, ' ')}</span>
          {school.currentPhase !== 'ANNUAL_RENEWAL' && (
            <button onClick={advancePhase}>Advance to Next Phase</button>
          )}
        </div>
      </div>
      {warning && <p className="warning">{warning}</p>}

      <div className="tab-bar">
        {TABS.map((t) => (
          <button key={t} className={`tab-button${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'Checklist' && <SchoolChecklistTab schoolId={id} token={token} />}
        {tab === 'Teachers' && <SchoolTeachersTab schoolId={id} token={token} />}
        {tab === 'Infra' && <SchoolInfraTab schoolId={id} token={token} />}
        {tab === 'Workshops' && <SchoolWorkshopsTab schoolId={id} token={token} />}
        {tab === 'Engagement' && <SchoolEngagementTab schoolId={id} token={token} />}
        {tab === 'Competitions' && <SchoolCompetitionsTab schoolId={id} token={token} />}
        {tab === 'Renewal' && <SchoolRenewalsTab schoolId={id} token={token} />}
      </div>
    </div>
  );
}
