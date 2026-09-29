import { useEffect, useMemo, useState } from 'react';
import { api, Student } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { BuildingIcon } from '../../components/icons';

// Students the school sent through its school details page (SOP Phase 5).
// Download the list for the LMS, create the logins there, then mark them
// here — every student marked ticks "Student LMS credentials generated".
export function SchoolStudentsTab({ schoolId }: { schoolId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    api
      .listStudents(schoolId)
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }

  useEffect(reload, [schoolId]);

  const byGrade = useMemo(() => {
    const groups = new Map<string, Student[]>();
    for (const s of students) {
      const key = s.grade ? `Grade ${s.grade}` : 'No grade given';
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups.entries()];
  }, [students]);
  const pending = students.filter((s) => !s.lmsCredentialGenerated).length;

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const cell = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Name,Grade,Section', ...students.map((s) => [s.name, s.grade, s.section].map(cell).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-for-lms.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {students.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon width={22} height={22} />}
          title="No students yet"
          text="The school adds them on its school details page — the link is in the email from the Teachers tab."
        />
      ) : (
        <>
          <div className="button-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="muted small" style={{ margin: 0 }}>
              {students.length} student(s) · {pending === 0 ? 'all LMS logins created ✓' : `${pending} still need an LMS login`}. Click a row to toggle its LMS status.
            </p>
            <div className="button-row">
              <button className="secondary" onClick={downloadCsv}>
                Download for LMS (CSV)
              </button>
              <button onClick={() => act(() => api.markAllStudentsLms(schoolId))} disabled={busy || pending === 0}>
                Mark all LMS logins created
              </button>
            </div>
          </div>
          {byGrade.map(([grade, list]) => (
            <div key={grade} className="checklist-phase">
              <h3>
                <span>{grade}</span>
                <span>{list.length} student(s)</span>
              </h3>
              <ul className="row-list">
                {list.map((s) => (
                  <li key={s.id} className="clickable-row" onClick={() => act(() => api.setStudentLms(schoolId, s.id, !s.lmsCredentialGenerated))}>
                    <div className="row-list-main">
                      <span className="row-list-name">{s.name}</span>
                      <span className="row-list-meta">{s.section ? `Section ${s.section}` : '—'}</span>
                    </div>
                    <div className="row-list-side">
                      <span className={`badge ${s.lmsCredentialGenerated ? 'badge-success' : 'badge-muted'}`}>
                        {s.lmsCredentialGenerated ? 'LMS login created' : 'LMS login pending'}
                      </span>
                      <button
                        className="ghost"
                        aria-label={`Remove ${s.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${s.name}?`)) act(() => api.deleteStudent(schoolId, s.id));
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
