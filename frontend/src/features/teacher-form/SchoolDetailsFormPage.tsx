import { ChangeEvent, FormEvent, ReactNode, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, SchoolDetailsInfo, StudentFormRow, TeacherFormRow } from '../../lib/api';
import { makeCobrandedLogo, resizeImageFile } from '../../lib/logo-image';
import { RowsColumn, RowsTable } from '../../components/RowsTable';

const TEACHER_COLUMNS: RowsColumn<TeacherFormRow>[] = [
  { key: 'name', label: 'Name *', placeholder: 'e.g. Priya Sharma', wide: true },
  { key: 'phone', label: 'Phone', placeholder: 'e.g. 98765 43210' },
  { key: 'designation', label: 'Designation', placeholder: 'e.g. Computer Teacher' },
  { key: 'gradeAssigned', label: 'Grades taught', placeholder: 'e.g. 3–5' },
];
const STUDENT_COLUMNS: RowsColumn<StudentFormRow>[] = [
  { key: 'name', label: 'Name *', placeholder: 'e.g. Aarav Gupta', wide: true },
  { key: 'grade', label: 'Grade', placeholder: 'e.g. 6' },
  { key: 'section', label: 'Section', placeholder: 'e.g. A' },
];
const emptyTeacher = (): TeacherFormRow => ({ name: '', phone: '', designation: '', gradeAssigned: '' });
const emptyStudent = (): StudentFormRow => ({ name: '', grade: '', section: '' });
const rowsOf = <T,>(make: () => T, n: number) => Array.from({ length: n }, make);
const emptyInfra = { labCapacity: '', internetConnectivity: '', systemsPerStudent: '' };

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Public page (no login): the one link a school gets by email to send us
// everything onboarding needs — teachers, students, logo, lab & internet
// and an orientation date. One Submit button (always visible at the bottom)
// saves every part that has something new; the logo uploads as soon as it's
// picked. Parts can be filled now or later with the same link; everything
// lands in the tool and ticks its checklist task. (Lives at /teacher-form/…
// — the page grew from the teacher form, and links already emailed must
// keep working.)
export function SchoolDetailsFormPage() {
  const { schoolId = '', token = '' } = useParams();
  const [info, setInfo] = useState<SchoolDetailsInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [teachers, setTeachers] = useState(rowsOf(emptyTeacher, 5));
  const [students, setStudents] = useState(rowsOf(emptyStudent, 10));
  const [infra, setInfra] = useState(emptyInfra);
  const [orientation, setOrientation] = useState({ date: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);

  function reload() {
    return api
      .getTeacherForm(schoolId, token)
      .then((i) => {
        setInfo(i);
        return i;
      })
      .catch(() => {
        setLoadError('This link is not valid. Please use the link from your codevidhya email.');
        return null;
      });
  }

  useEffect(() => {
    // Show what the school already sent, so it can be checked or changed.
    reload().then((i) => {
      if (!i) return;
      if (i.infra) {
        setInfra({
          labCapacity: i.infra.labCapacity ?? '',
          internetConnectivity: i.infra.internetConnectivity ?? '',
          systemsPerStudent: i.infra.systemsPerStudent ?? '',
        });
      }
      if (i.orientation) setOrientation({ date: i.orientation.date.slice(0, 10), note: i.orientation.note ?? '' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, token]);

  if (!info) {
    return (
      <div className="auth-shell">
        <div className="public-form">
          <h1>School details</h1>
          {loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading…</p>}
        </div>
      </div>
    );
  }

  const newTeachers = teachers.filter((r) => r.name.trim());
  const newStudents = students.filter((r) => r.name.trim());
  const savedInfra = {
    labCapacity: info.infra?.labCapacity ?? '',
    internetConnectivity: info.infra?.internetConnectivity ?? '',
    systemsPerStudent: info.infra?.systemsPerStudent ?? '',
  };
  const infraChanged =
    Object.values(infra).some((v) => v.trim()) && JSON.stringify(infra) !== JSON.stringify(savedInfra);
  const orientationChanged =
    !!orientation.date &&
    (orientation.date !== info.orientation?.date.slice(0, 10) || orientation.note !== (info.orientation?.note ?? ''));

  const pending = [
    newTeachers.length > 0 && `${newTeachers.length} teacher${newTeachers.length === 1 ? '' : 's'}`,
    newStudents.length > 0 && `${newStudents.length} student${newStudents.length === 1 ? '' : 's'}`,
    infraChanged && 'lab details',
    orientationChanged && 'orientation date',
  ].filter(Boolean) as string[];

  // Saves each part that has something new, in order; stops at the first
  // failure so nothing is silently lost (what saved stays saved).
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending.length === 0) return;
    setSubmitting(true);
    setResult(null);
    const lines: string[] = [];
    try {
      if (newTeachers.length > 0) {
        const { added } = await api.submitTeacherForm(schoolId, token, newTeachers);
        setTeachers(rowsOf(emptyTeacher, 5));
        lines.push(`✓ ${added} teacher(s) received`);
      }
      if (newStudents.length > 0) {
        const { added } = await api.submitStudentsForm(schoolId, token, newStudents);
        setStudents(rowsOf(emptyStudent, 10));
        lines.push(`✓ ${added} student(s) received`);
      }
      if (infraChanged) {
        await api.saveSchoolFormInfra(schoolId, token, infra);
        lines.push('✓ Lab details saved');
      }
      if (orientationChanged) {
        await api.saveSchoolFormOrientation(schoolId, token, orientation);
        lines.push('✓ Orientation date saved — your account manager will confirm it');
      }
      await reload();
      setResult({ ok: true, lines });
    } catch (err) {
      await reload();
      setResult({ ok: false, lines: [...lines, `✕ ${err instanceof Error ? err.message : 'Could not save — please try again.'}`] });
    } finally {
      setSubmitting(false);
    }
  }

  const allDone = info.partsDone === info.partsTotal;

  return (
    <div className="auth-shell">
      <form className="public-form" onSubmit={onSubmit}>
        <h1>School details</h1>
        <p className="auth-subtitle">{info.schoolName} · codevidhya onboarding</p>
        <div className="school-form-progress">
          <div className="school-form-progress-bar">
            <span style={{ width: `${(info.partsDone / info.partsTotal) * 100}%` }} />
          </div>
          <span className="small">
            <strong>
              {info.partsDone} of {info.partsTotal}
            </strong>{' '}
            parts done
            {allDone ? ' — thank you! 🎉' : ' · fill in what you have, press Submit at the bottom, and come back later for the rest'}
          </span>
        </div>

        <Part n={1} title="Teacher details" done={info.teachersOnFile > 0} doneText={`${info.teachersOnFile} received`}>
          <p className="muted small">
            One row per teacher — only the name is required. Have a list in Excel or Google Sheets? Copy the rows and paste them into the first Name box.
            {info.teachersOnFile > 0 && ' You can add more teachers anytime.'}
          </p>
          <RowsTable columns={TEACHER_COLUMNS} rows={teachers} setRows={setTeachers} emptyRow={emptyTeacher} maxRows={100} rowLabel="Teacher" />
        </Part>

        <Part n={2} title="Student details" done={info.studentsOnFile > 0} doneText={`${info.studentsOnFile} received`}>
          <p className="muted small">
            Name, grade and section of the students joining the program — used to create their LMS logins. Easiest: copy the Name, Grade and Section columns
            from your Excel sheet and paste them into the first Name box. You can send one class at a time.
          </p>
          <RowsTable columns={STUDENT_COLUMNS} rows={students} setRows={setStudents} emptyRow={emptyStudent} maxRows={500} rowLabel="Student" />
        </Part>

        <LogoPart info={info} schoolId={schoolId} token={token} onSaved={reload} />

        <Part n={4} title="Computer lab & internet" done={!!info.infra} doneText="Received">
          <p className="muted small">Helps us plan the right mix of theory and practical sessions.</p>
          <div className="school-part-grid">
            <label>
              Computers in the lab
              <input placeholder="e.g. 30 computers" value={infra.labCapacity} onChange={(e) => setInfra({ ...infra, labCapacity: e.target.value })} />
            </label>
            <label>
              Internet connection
              <select value={infra.internetConnectivity} onChange={(e) => setInfra({ ...infra, internetConnectivity: e.target.value })}>
                <option value="">Choose…</option>
                <option value="Good — works well">Good — works well</option>
                <option value="Slow or unreliable">Slow or unreliable</option>
                <option value="No internet in the lab">No internet in the lab</option>
              </select>
            </label>
            <label>
              Students per computer
              <input placeholder="e.g. 2" value={infra.systemsPerStudent} onChange={(e) => setInfra({ ...infra, systemsPerStudent: e.target.value })} />
            </label>
          </div>
        </Part>

        <Part
          n={5}
          title="Orientation date"
          done={!!info.orientation}
          doneText={info.orientation ? new Date(info.orientation.date).toLocaleDateString('en-IN', { dateStyle: 'long' }) : undefined}
        >
          <p className="muted small">
            Pick a day that suits you for the leadership orientation and teacher induction session. Your account manager will confirm it.
          </p>
          <div className="school-part-grid">
            <label>
              Preferred date
              <input type="date" min={tomorrow()} value={orientation.date} onChange={(e) => setOrientation({ ...orientation, date: e.target.value })} />
            </label>
            <label>
              Preferred time or note (optional)
              <input
                placeholder="e.g. 10 AM, after assembly"
                value={orientation.note}
                onChange={(e) => setOrientation({ ...orientation, note: e.target.value })}
                maxLength={200}
              />
            </label>
          </div>
        </Part>

        {result && (
          <div className={result.ok ? 'public-form-success' : 'error'}>
            {result.ok && <strong>Thank you! Your details were sent.</strong>}
            {result.lines.map((l) => (
              <div key={l} className="small">
                {l}
              </div>
            ))}
          </div>
        )}

        <div className="school-form-submit">
          <span className="small muted">
            {pending.length > 0 ? `Ready to send: ${pending.join(', ')}` : allDone ? 'Everything is received — thank you!' : 'Fill in any part above, then press Submit.'}
          </span>
          <button type="submit" disabled={submitting || pending.length === 0}>
            {submitting ? 'Submitting…' : 'Submit school details'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Part({ n, title, done, doneText, children }: { n: number; title: string; done: boolean; doneText?: string; children: ReactNode }) {
  return (
    <section className={`school-part${done ? ' done' : ''}`}>
      <div className="school-part-head">
        <h2>
          <span className="onboarding-step-num">{done ? '✓' : n}</span>
          {title}
        </h2>
        <span className={`badge ${done ? 'badge-success' : 'badge-warning'}`}>{done ? doneText ?? 'Done' : 'To do'}</span>
      </div>
      {children}
    </section>
  );
}

// The logo uploads the moment it's picked (no Submit needed), with the
// co-branded partnership logo made from it right here in the browser.
function LogoPart({ info, schoolId, token, onSaved }: { info: SchoolDetailsInfo; schoolId: string; token: string; onSaved: () => Promise<unknown> }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus('uploading');
    try {
      const logo = await resizeImageFile(file);
      setPreview(logo);
      const cobranded = await makeCobrandedLogo(logo, info.schoolName).catch(() => undefined);
      await api.uploadTeacherFormLogo(schoolId, token, logo, cobranded);
      await onSaved();
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };
  return (
    <Part n={3} title="School logo" done={info.hasLogo} doneText="Received">
      <div className="public-form-logo">
        <div className="onboarding-logo-box">
          {preview ? <img src={preview} alt="Your school logo" /> : <span className="muted small">{info.hasLogo ? '✓ Received' : 'Logo'}</span>}
        </div>
        <div>
          <p className="muted small">For our co-branded partnership logo. PNG or JPG — it uploads as soon as you choose it.</p>
          <label className="button-like">
            {status === 'uploading' ? 'Uploading…' : info.hasLogo ? 'Upload a new logo' : 'Choose logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} disabled={status === 'uploading'} hidden />
          </label>
          {status === 'done' && <p className="success small">Thank you — logo received.</p>}
          {status === 'error' && <p className="error small">Couldn’t upload that image — please try a PNG or JPG under 1.5 MB.</p>}
        </div>
      </div>
    </Part>
  );
}
