import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, School } from '../../lib/api';
import { SchoolChecklistTab } from './SchoolChecklistTab';
import { SchoolOnboardingTab } from './SchoolOnboardingTab';
import { SchoolTeachersTab } from './SchoolTeachersTab';
import { SchoolStudentsTab } from './SchoolStudentsTab';
import { SchoolInfraTab } from './SchoolInfraTab';
import { SchoolWorkshopsTab } from './SchoolWorkshopsTab';
import { SchoolEngagementTab } from './SchoolEngagementTab';
import { SchoolCompetitionsTab } from './SchoolCompetitionsTab';
import { SchoolRenewalsTab } from './SchoolRenewalsTab';
import { SchoolActivityTab } from './SchoolActivityTab';
import { EditSchoolModal } from './EditSchoolModal';
import { PhaseProgress } from '../../components/PhaseProgress';
import { Skeleton, SkeletonCard } from '../../components/Skeleton';

const TABS = ['Checklist', 'Onboarding', 'Teachers', 'Students', 'Infra', 'Workshops', 'Engagement', 'Competitions', 'Renewal', 'Activity'] as const;
type Tab = (typeof TABS)[number];

export function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [school, setSchool] = useState<School | null>(null);
  const [tab, setTab] = useState<Tab>('Checklist');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Bumped to remount the active tab so it refetches — the checklist agent
  // may have ticked tasks or advanced the phase behind the scenes.
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() {
    if (!id) return;
    api.getSchool(id).then(setSchool).catch((err) => setError(err.message));
  }

  useEffect(reload, [id]);

  // A just-created school's emails (and the ticks they earn) finish a few
  // seconds after the page opens — refresh once when they should be done.
  const justCreated = !!school && Date.now() - new Date(school.createdAt).getTime() < 60_000;
  useEffect(() => {
    if (!justCreated) return;
    const timer = setTimeout(() => {
      reload();
      setRefreshKey((k) => k + 1);
    }, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCreated, id]);

  async function advancePhase() {
    if (!id) return;
    setWarning(null);
    try {
      const result = await api.advanceSchoolPhase(id);
      setSchool(result.school);
      if (result.warning) setWarning(result.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not advance phase');
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!school || !id) {
    return (
      <div className="page">
        <div className="school-header">
          <div style={{ width: '100%', maxWidth: 360 }}>
            <Skeleton height={24} width="60%" style={{ marginBottom: 10 }} />
            <Skeleton height={14} width="80%" />
          </div>
        </div>
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="school-header">
        <div>
          <h1>{school.name}</h1>
          <p className="muted">
            {school.city ?? '—'}
            {school.state ? `, ${school.state}` : ''} · {school.productProgram ?? 'No program on file'}
          </p>
          <p className="muted small">
            Account manager: {school.assignedAccountManager?.name ?? 'Unassigned'} · Owner email:{' '}
            {school.ownerEmail ?? 'none on file'}
          </p>
          {school.orientationPreferredDate && (
            <p className="small">
              📅 School’s preferred orientation date:{' '}
              <strong>{new Date(school.orientationPreferredDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</strong>
              {school.orientationNote ? ` — ${school.orientationNote}` : ''}
            </p>
          )}
        </div>
        <div className="school-header-phase">
          <PhaseProgress phase={school.currentPhase} />
          <div className="button-row">
            <button className="secondary" onClick={() => setEditing(true)}>
              Edit school
            </button>
            {school.currentPhase !== 'ANNUAL_RENEWAL' && (
              <button onClick={advancePhase}>Advance to Next Phase</button>
            )}
          </div>
        </div>
      </div>
      {warning && <p className="warning">{warning}</p>}
      {editing && (
        <EditSchoolModal
          school={school}
          onSaved={(updated) => {
            setSchool(updated);
            setEditing(false);
            setRefreshKey((k) => k + 1);
          }}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="tab-bar">
        {TABS.map((t) => (
          <button key={t} className={`tab-button${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="tab-content" key={refreshKey}>
        {tab === 'Checklist' && <SchoolChecklistTab schoolId={id} />}
        {tab === 'Onboarding' && <SchoolOnboardingTab schoolId={id} />}
        {tab === 'Teachers' && <SchoolTeachersTab schoolId={id} />}
        {tab === 'Students' && <SchoolStudentsTab schoolId={id} />}
        {tab === 'Infra' && <SchoolInfraTab schoolId={id} />}
        {tab === 'Workshops' && <SchoolWorkshopsTab schoolId={id} />}
        {tab === 'Engagement' && <SchoolEngagementTab schoolId={id} />}
        {tab === 'Competitions' && <SchoolCompetitionsTab schoolId={id} />}
        {tab === 'Renewal' && <SchoolRenewalsTab schoolId={id} />}
        {tab === 'Activity' && <SchoolActivityTab schoolId={id} />}
      </div>
    </div>
  );
}
