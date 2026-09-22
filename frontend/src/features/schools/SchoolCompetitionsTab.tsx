import { FormEvent, useEffect, useState } from 'react';
import { CompetitionType } from '@b2b-ops/shared';
import { api, CompetitionParticipation } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { SparkleIcon } from '../../components/icons';

export function SchoolCompetitionsTab({ schoolId, token }: { schoolId: string; token: string }) {
  const [competitions, setCompetitions] = useState<CompetitionParticipation[]>([]);
  const [form, setForm] = useState<{
    name: string;
    type: CompetitionType;
    date: string;
    studentsParticipated: string;
    certificatesIssued: boolean;
    prizesAwarded: string;
    teacherCertified: boolean;
  }>({
    name: '',
    type: CompetitionType.INTERNAL,
    date: '',
    studentsParticipated: '',
    certificatesIssued: false,
    prizesAwarded: '',
    teacherCertified: false,
  });
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listCompetitions(schoolId, token).then(setCompetitions).catch((err) => setError(err.message));
  }

  useEffect(reload, [schoolId]);

  async function addCompetition(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createCompetition(
        schoolId,
        {
          ...form,
          date: new Date(form.date).toISOString(),
          studentsParticipated: form.studentsParticipated ? Number(form.studentsParticipated) : undefined,
        },
        token,
      );
      setForm({
        name: '',
        type: CompetitionType.INTERNAL,
        date: '',
        studentsParticipated: '',
        certificatesIssued: false,
        prizesAwarded: '',
        teacherCertified: false,
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add competition');
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {competitions.length === 0 ? (
        <EmptyState
          icon={<SparkleIcon width={22} height={22} />}
          title="No competitions recorded yet"
          text="Use the form below to record the first internal or external competition."
        />
      ) : (
        <div className="workshop-list">
          {competitions.map((c) => (
            <div key={c.id} className="card">
              <div className="workshop-header">
                <strong>{c.name}</strong>
                <span className="badge badge-muted">{c.type}</span>
              </div>
              <p className="muted small">
                {new Date(c.date).toLocaleDateString()}
                {c.studentsParticipated != null ? ` · ${c.studentsParticipated} student${c.studentsParticipated === 1 ? '' : 's'}` : ''}
              </p>
              <div className="button-row" style={{ marginTop: 8 }}>
                <span className={`badge ${c.certificatesIssued ? 'badge-success' : 'badge-muted'}`}>
                  {c.certificatesIssued ? 'Certificates issued' : 'No certificates yet'}
                </span>
                <span className={`badge ${c.teacherCertified ? 'badge-success' : 'badge-muted'}`}>
                  {c.teacherCertified ? 'Teacher certified' : 'Teacher not certified'}
                </span>
              </div>
              {c.prizesAwarded && <p className="small" style={{ marginTop: 8 }}>Prizes: {c.prizesAwarded}</p>}
            </div>
          ))}
        </div>
      )}

      <h3>Record a competition</h3>
      <form className="form-grid" onSubmit={addCompetition}>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Type
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CompetitionType })}>
            <option value={CompetitionType.INTERNAL}>Internal</option>
            <option value={CompetitionType.EXTERNAL}>External</option>
          </select>
        </label>
        <label>
          Date
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </label>
        <label>
          Students participated
          <input
            type="number"
            min={0}
            value={form.studentsParticipated}
            onChange={(e) => setForm({ ...form, studentsParticipated: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.certificatesIssued}
            onChange={(e) => setForm({ ...form, certificatesIssued: e.target.checked })}
          />
          Certificates issued
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.teacherCertified}
            onChange={(e) => setForm({ ...form, teacherCertified: e.target.checked })}
          />
          Teacher certified
        </label>
        <label className="span-2">
          Prizes awarded
          <input value={form.prizesAwarded} onChange={(e) => setForm({ ...form, prizesAwarded: e.target.value })} />
        </label>
        <button type="submit" className="span-2">
          Add
        </button>
      </form>
    </div>
  );
}
