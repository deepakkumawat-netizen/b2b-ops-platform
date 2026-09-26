import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { SkeletonCard } from '../../components/Skeleton';

export function SchoolInfraTab({ schoolId }: { schoolId: string }) {
  const [form, setForm] = useState({
    labCapacity: '',
    internetConnectivity: '',
    systemsPerStudent: '',
    recommendedSessionMix: '',
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getInfraDiagnostic(schoolId)
      .then((d) => {
        if (d) {
          setForm({
            labCapacity: d.labCapacity ?? '',
            internetConnectivity: d.internetConnectivity ?? '',
            systemsPerStudent: d.systemsPerStudent ?? '',
            recommendedSessionMix: d.recommendedSessionMix ?? '',
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api.upsertInfraDiagnostic(schoolId, form);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  if (loading) return <SkeletonCard lines={4} />;

  return (
    <div className="card">
      <h2>Infrastructure diagnostic</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Captured from the school's diagnostic form response — drives the theory/practical session mix.
      </p>
      <form
        className="form-grid"
        onSubmit={onSubmit}
        style={{ border: 'none', padding: 0, boxShadow: 'none', maxWidth: 'none' }}
      >
        <label>
          Lab capacity
          <input value={form.labCapacity} onChange={(e) => setForm({ ...form, labCapacity: e.target.value })} />
        </label>
        <label>
          Internet connectivity
          <input
            value={form.internetConnectivity}
            onChange={(e) => setForm({ ...form, internetConnectivity: e.target.value })}
          />
        </label>
        <label>
          Systems per student
          <input
            value={form.systemsPerStudent}
            onChange={(e) => setForm({ ...form, systemsPerStudent: e.target.value })}
          />
        </label>
        <label className="span-2">
          Recommended session mix (theory/practical)
          <textarea
            value={form.recommendedSessionMix}
            onChange={(e) => setForm({ ...form, recommendedSessionMix: e.target.value })}
          />
        </label>
        {error && <p className="error span-2">{error}</p>}
        {saved && <p className="success span-2">Saved.</p>}
        <button type="submit" className="span-2">
          Save
        </button>
      </form>
    </div>
  );
}
