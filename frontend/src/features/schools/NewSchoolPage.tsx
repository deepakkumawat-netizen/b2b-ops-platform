import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrainingMode } from '@b2b-ops/shared';
import { api, staffToken } from '../../lib/api';

// SOP Phase 1 — Sales-to-Operations Handover: the fields the SOP requires be
// captured before any onboarding activity begins.
export function NewSchoolPage() {
  const navigate = useNavigate();
  const token = staffToken.get()!;
  const [form, setForm] = useState({
    name: '',
    city: '',
    state: '',
    ownerName: '',
    ownerDesignation: '',
    ownerEmail: '',
    ownerPhone: '',
    productProgram: '',
    gradeFrom: '',
    gradeTo: '',
    workshopsCommitted: '',
    trainingMode: '' as TrainingMode | '',
    specialCommitments: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const school = await api.createSchool(
        {
          ...form,
          workshopsCommitted: form.workshopsCommitted ? Number(form.workshopsCommitted) : undefined,
          trainingMode: form.trainingMode || undefined,
        },
        token,
      );
      navigate(`/schools/${school.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create school');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>New School — Sales Handover</h1>
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          School name
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label>
          City
          <input value={form.city} onChange={(e) => set('city', e.target.value)} />
        </label>
        <label>
          State
          <input value={form.state} onChange={(e) => set('state', e.target.value)} />
        </label>
        <label>
          Owner / decision-maker name
          <input value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
        </label>
        <label>
          Owner designation
          <input value={form.ownerDesignation} onChange={(e) => set('ownerDesignation', e.target.value)} />
        </label>
        <label>
          Owner email
          <input type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} />
        </label>
        <label>
          Owner phone
          <input value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} />
        </label>
        <label>
          Product / program
          <input value={form.productProgram} onChange={(e) => set('productProgram', e.target.value)} />
        </label>
        <label>
          Grade from
          <input value={form.gradeFrom} onChange={(e) => set('gradeFrom', e.target.value)} />
        </label>
        <label>
          Grade to
          <input value={form.gradeTo} onChange={(e) => set('gradeTo', e.target.value)} />
        </label>
        <label>
          Workshops committed
          <input type="number" min={0} value={form.workshopsCommitted} onChange={(e) => set('workshopsCommitted', e.target.value)} />
        </label>
        <label>
          Training mode
          <select value={form.trainingMode} onChange={(e) => set('trainingMode', e.target.value as TrainingMode)}>
            <option value="">—</option>
            <option value={TrainingMode.ONLINE}>Online</option>
            <option value={TrainingMode.OFFLINE}>Offline</option>
          </select>
        </label>
        <label className="span-2">
          Special commitments
          <textarea value={form.specialCommitments} onChange={(e) => set('specialCommitments', e.target.value)} />
        </label>
        {error && <p className="error span-2">{error}</p>}
        <button type="submit" disabled={submitting} className="span-2">
          {submitting ? 'Creating…' : 'Create school'}
        </button>
      </form>
    </div>
  );
}
