import { FormEvent, useEffect, useState } from 'react';
import { api, Teacher } from '../../lib/api';

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
    await api.updateTeacher(schoolId, teacher.id, { lmsCredentialGenerated: !teacher.lmsCredentialGenerated }, token);
    reload();
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Designation</th>
            <th>Grade</th>
            <th>LMS Credentials</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.phone ?? '—'}</td>
              <td>{t.designation ?? '—'}</td>
              <td>{t.gradeAssigned ?? '—'}</td>
              <td>
                <label>
                  <input type="checkbox" checked={t.lmsCredentialGenerated} onChange={() => toggleCredential(t)} />
                  Generated
                </label>
              </td>
            </tr>
          ))}
          {teachers.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No teachers added yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
