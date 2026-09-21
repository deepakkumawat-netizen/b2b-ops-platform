import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Country, State, City } from 'country-state-city';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { TrainingMode } from '@b2b-ops/shared';
import { api, staffToken } from '../../lib/api';

const INDIA_ISO = 'IN';
const countries = Country.getAllCountries();

// SOP Phase 1 — Sales-to-Operations Handover: the fields the SOP requires be
// captured before any onboarding activity begins.
export function NewSchoolPage() {
  const navigate = useNavigate();
  const token = staffToken.get()!;
  const [form, setForm] = useState({
    name: '',
    countryCode: INDIA_ISO,
    stateCode: '',
    city: '',
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

  const states = useMemo(() => State.getStatesOfCountry(form.countryCode), [form.countryCode]);
  const districts = useMemo(
    () => (form.stateCode ? City.getCitiesOfState(form.countryCode, form.stateCode) : []),
    [form.countryCode, form.stateCode],
  );

  function onCountryChange(isoCode: string) {
    setForm((f) => ({ ...f, countryCode: isoCode, stateCode: '', city: '' }));
  }

  function onStateChange(isoCode: string) {
    setForm((f) => ({ ...f, stateCode: isoCode, city: '' }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const country = Country.getCountryByCode(form.countryCode)?.name;
      const state = states.find((s) => s.isoCode === form.stateCode)?.name;
      const school = await api.createSchool(
        {
          name: form.name,
          country,
          state,
          city: form.city || undefined,
          ownerName: form.ownerName,
          ownerDesignation: form.ownerDesignation,
          ownerEmail: form.ownerEmail,
          ownerPhone: form.ownerPhone,
          productProgram: form.productProgram,
          gradeFrom: form.gradeFrom,
          gradeTo: form.gradeTo,
          specialCommitments: form.specialCommitments,
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
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Capture what the SOP requires before any onboarding activity begins — the rest of the checklist unlocks
        once this is saved.
      </p>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="form-section-title">School</div>
        <label>
          School name
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label>
          Country
          <select value={form.countryCode} onChange={(e) => onCountryChange(e.target.value)}>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          State
          <select value={form.stateCode} onChange={(e) => onStateChange(e.target.value)} disabled={!states.length}>
            <option value="">—</option>
            {states.map((s) => (
              <option key={s.isoCode} value={s.isoCode}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          District / City
          <select
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            disabled={!districts.length}
          >
            <option value="">—</option>
            {districts.map((d) => (
              <option key={`${d.name}-${d.latitude}`} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-section-title">Owner / Decision-maker</div>
        <label>
          Name
          <input value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
        </label>
        <label>
          Designation
          <input value={form.ownerDesignation} onChange={(e) => set('ownerDesignation', e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} />
        </label>
        <label>
          Phone
          <PhoneInput
            international
            countryCallingCodeEditable={false}
            country={form.countryCode as never}
            value={form.ownerPhone}
            onChange={(value) => set('ownerPhone', value ?? '')}
          />
        </label>

        <div className="form-section-title">Program &amp; commitments</div>
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
