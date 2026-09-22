import { FormEvent, useEffect, useState } from 'react';
import { api, Teacher } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { BuildingIcon } from '../../components/icons';

export function SchoolTeachersTab({ schoolId, token }: { schoolId: string; token: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', designation: '', gradeAssigned: '' });
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listTeachers(schoolId, token).then(setTeachers).catch((err) => setError(err.message));
  }

  useEffect(reload, [schoolId]);

  async function addTeacher(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createTeacher(schoolId, form, token);
      setForm({ name: '', phone: '', designation: '', gradeAssigned: '' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add teacher');
    }
  }

  async function toggleCredential(teacher: Teacher) {
    try {
      await api.updateTeacher(schoolId, teacher.id, { lmsCredentialGenerated: !teacher.lmsCredentialGenerated }, token);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update teacher');
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      <p className="muted small" style={{ marginTop: 0 }}>
        Click anywhere on a row to toggle LMS credential status.
      </p>

      {teachers.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon width={22} height={22} />}
          title="No teachers added yet"
          text="Use the form below to add the first teacher for this school."
        />
      ) : (
        <ul className="row-list">
          {teachers.map((t) => (
            <li key={t.id} className="clickable-row" onClick={() => toggleCredential(t)}>
              <div className="row-list-main">
                <span className="row-list-name">{t.name}</span>
                <span className="row-list-meta">
                  {[t.designation, t.gradeAssigned ? `Grade ${t.gradeAssigned}` : null, t.phone].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
              <div className="row-list-side">
                <span className={`badge ${t.lmsCredentialGenerated ? 'badge-success' : 'badge-muted'}`}>
                  {t.lmsCredentialGenerated ? 'LMS credential generated' : 'LMS credential pending'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Add teacher</h3>
      <form className="form-row" onSubmit={addTeacher}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input
          placeholder="Designation"
          value={form.designation}
          onChange={(e) => setForm({ ...form, designation: e.target.value })}
        />
        <input
          placeholder="Grade assigned"
          value={form.gradeAssigned}
          onChange={(e) => setForm({ ...form, gradeAssigned: e.target.value })}
        />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}
