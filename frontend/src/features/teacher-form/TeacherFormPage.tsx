import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, TeacherFormRow } from '../../lib/api';

const emptyRow = (): TeacherFormRow => ({ name: '', phone: '', designation: '', gradeAssigned: '' });

// Public page (no login): the school opens it from the teacher-details email
// the agent sends. Whatever they submit lands in the school's Teachers tab
// and ticks "Teacher details collected" on the checklist.
export function TeacherFormPage() {
  const { schoolId = '', token = '' } = useParams();
  const [info, setInfo] = useState<{ schoolName: string; teachersOnFile: number } | null>(null);
  const [rows, setRows] = useState<TeacherFormRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  useEffect(() => {
    api
      .getTeacherForm(schoolId, token)
      .then(setInfo)
      .catch(() => setError('This form link is not valid. Please use the link from your CodeVidhya email.'));
  }, [schoolId, token]);

  function setCell(i: number, key: keyof TeacherFormRow, value: string) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const teachers = rows.filter((r) => r.name.trim());
    if (teachers.length === 0) {
      setError('Add at least one teacher’s name.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.submitTeacherForm(schoolId, token, teachers);
      setAdded(result.added);
      setRows([emptyRow(), emptyRow(), emptyRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="public-form">
        <h1>Teacher details</h1>
        {info && (
          <p className="auth-subtitle">
            {info.schoolName} · CodeVidhya onboarding
            {info.teachersOnFile > 0 && ` · ${info.teachersOnFile} teacher(s) already on file`}
          </p>
        )}

        {!info && !error && <p className="muted">Loading…</p>}
        {!info && error && <p className="error">{error}</p>}

        {info && added !== null && (
          <div className="public-form-success">
            <strong>Thank you! {added} teacher(s) received.</strong>
            <p className="muted small">Your CodeVidhya account manager will be in touch about LMS access and training. You can add more below.</p>
          </div>
        )}

        {info && (
          <form onSubmit={onSubmit}>
            <p className="muted small">One row per teacher. Only the name is required.</p>
            <div className="public-form-rows">
              {rows.map((row, i) => (
                <div key={i} className="public-form-row">
                  <input placeholder="Name *" value={row.name} onChange={(e) => setCell(i, 'name', e.target.value)} aria-label={`Teacher ${i + 1} name`} />
                  <input placeholder="Phone" value={row.phone} onChange={(e) => setCell(i, 'phone', e.target.value)} aria-label={`Teacher ${i + 1} phone`} />
                  <input
                    placeholder="Designation"
                    value={row.designation}
                    onChange={(e) => setCell(i, 'designation', e.target.value)}
                    aria-label={`Teacher ${i + 1} designation`}
                  />
                  <input
                    placeholder="Grades taught"
                    value={row.gradeAssigned}
                    onChange={(e) => setCell(i, 'gradeAssigned', e.target.value)}
                    aria-label={`Teacher ${i + 1} grades`}
                  />
                  {rows.length > 1 && (
                    <button type="button" className="secondary" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={`Remove teacher ${i + 1}`}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="button-row">
              <button type="button" className="secondary" onClick={() => setRows((r) => [...r, emptyRow()])} disabled={rows.length >= 100}>
                + Add another teacher
              </button>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit teacher details'}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
