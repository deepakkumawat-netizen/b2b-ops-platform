import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';

export function SchoolInfraTab({ schoolId, token }: { schoolId: string; token: string }) {
  const [form, setForm] = useState({
    labCapacity: '',
    internetConnectivity: '',
    systemsPerStudent: '',
    recommendedSessionMix: '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInfraDiagnostic(schoolId, token)
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
      .catch((err) => setError(err.message));
  }, [schoolId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api.upsertInfraDiagnostic(schoolId, form, token);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
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
        <input value={form.systemsPerStudent} onChange={(e) => setForm({ ...form, systemsPerStudent: e.target.value })} />
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
  );
}
