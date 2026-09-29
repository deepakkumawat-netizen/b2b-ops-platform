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

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Public page (no login): the one link a school gets by email to send us
// everything onboarding needs — teachers, students, logo, lab & internet
// and an orientation date. Each part can be done now or later with the
// same link; everything submitted lands in the tool and ticks its
// checklist task. (Lives at /teacher-form/… — the page grew from the
// teacher form, and links already emailed must keep working.)
export function SchoolDetailsFormPage() {
  const { schoolId = '', token = '' } = useParams();
  const [info, setInfo] = useState<SchoolDetailsInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function reload() {
    return api
      .getTeacherForm(schoolId, token)
      .then(setInfo)
      .catch(() => setLoadError('This link is not valid. Please use the link from your codevidhya email.'));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, token]);

  return (
    <div className="auth-shell">
      <div className="public-form">
        <h1>School details</h1>
        {info && (
          <>
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
                {info.partsDone === info.partsTotal ? ' — thank you! 🎉' : ' · fill in any part now, the rest later with the same link'}
              </span>
            </div>
          </>
        )}
        {!info && !loadError && <p className="muted">Loading…</p>}
        {loadError && <p className="error">{loadError}</p>}

        {info && (
          <>
            <TeachersPart info={info} schoolId={schoolId} token={token} onSaved={reload} />
            <StudentsPart info={info} schoolId={schoolId} token={token} onSaved={reload} />
            <LogoPart info={info} schoolId={schoolId} token={token} onSaved={reload} />
            <InfraPart info={info} schoolId={schoolId} token={token} onSaved={reload} />
            <OrientationPart info={info} schoolId={schoolId} token={token} onSaved={reload} />
          </>
        )}
      </div>
    </div>
  );
}

type PartProps = { info: SchoolDetailsInfo; schoolId: string; token: string; onSaved: () => Promise<unknown> };

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

/** Submit state shared by every part: busy flag, error, success message. */
function useSubmit(onSaved: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  async function submit(fn: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const message = await fn();
      await onSaved(); // refresh progress + badges first, so the thank-you never shows beside a stale "To do"
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save — please try again.');
    } finally {
      setBusy(false);
    }
  }
  const messages = (
    <>
      {success && <p className="success small">{success}</p>}
      {error && <p className="error small">{error}</p>}
    </>
  );
  return { busy, submit, messages };
}

function TeachersPart({ info, schoolId, token, onSaved }: PartProps) {
  const [rows, setRows] = useState(rowsOf(emptyTeacher, 5));
  const { busy, submit, messages } = useSubmit(onSaved);
  const filled = rows.filter((r) => r.name.trim());
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(async () => {
      const { added } = await api.submitTeacherForm(schoolId, token, filled);
      setRows(rowsOf(emptyTeacher, 5));
      return `Thank you! ${added} teacher(s) received.`;
    });
  };
  return (
    <Part n={1} title="Teacher details" done={info.teachersOnFile > 0} doneText={`${info.teachersOnFile} received`}>
      <form onSubmit={onSubmit}>
        <p className="muted small">
          One row per teacher — only the name is required. Have a list in Excel or Google Sheets? Copy the rows and paste them into the first Name box.
          {info.teachersOnFile > 0 && ' You can add more teachers anytime.'}
        </p>
        <RowsTable columns={TEACHER_COLUMNS} rows={rows} setRows={setRows} emptyRow={emptyTeacher} maxRows={100} rowLabel="Teacher" />
        <button type="submit" disabled={busy || filled.length === 0}>
          {busy ? 'Submitting…' : filled.length > 0 ? `Submit ${filled.length} teacher${filled.length === 1 ? '' : 's'}` : 'Submit teachers'}
        </button>
        {messages}
      </form>
    </Part>
  );
}

function StudentsPart({ info, schoolId, token, onSaved }: PartProps) {
  const [rows, setRows] = useState(rowsOf(emptyStudent, 10));
  const { busy, submit, messages } = useSubmit(onSaved);
  const filled = rows.filter((r) => r.name.trim());
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(async () => {
      const { added } = await api.submitStudentsForm(schoolId, token, filled);
      setRows(rowsOf(emptyStudent, 10));
      return `Thank you! ${added} student(s) received.`;
    });
  };
  return (
    <Part n={2} title="Student details" done={info.studentsOnFile > 0} doneText={`${info.studentsOnFile} received`}>
      <form onSubmit={onSubmit}>
        <p className="muted small">
          Name, grade and section of the students joining the program — used to create their LMS logins. Easiest: copy the Name, Grade and Section columns from your Excel sheet and paste them into the first Name box.
          You can send one class at a time.
        </p>
        <RowsTable columns={STUDENT_COLUMNS} rows={rows} setRows={setRows} emptyRow={emptyStudent} maxRows={500} rowLabel="Student" />
        <button type="submit" disabled={busy || filled.length === 0}>
          {busy ? 'Submitting…' : filled.length > 0 ? `Submit ${filled.length} student${filled.length === 1 ? '' : 's'}` : 'Submit students'}
        </button>
        {messages}
      </form>
    </Part>
  );
}

function LogoPart({ info, schoolId, token, onSaved }: PartProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const { busy, submit, messages } = useSubmit(onSaved);
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    submit(async () => {
      const logo = await resizeImageFile(file);
      setPreview(logo);
      // The co-branded partnership logo is made from it right here.
      const cobranded = await makeCobrandedLogo(logo, info.schoolName).catch(() => undefined);
      await api.uploadTeacherFormLogo(schoolId, token, logo, cobranded);
      return 'Thank you — logo received.';
    });
  };
  return (
    <Part n={3} title="School logo" done={info.hasLogo} doneText="Received">
      <div className="public-form-logo">
        <div className="onboarding-logo-box">
          {preview ? <img src={preview} alt="Your school logo" /> : <span className="muted small">{info.hasLogo ? '✓ Received' : 'Logo'}</span>}
        </div>
        <div>
          <p className="muted small">For our co-branded partnership logo. PNG or JPG.</p>
          <label className="button-like">
            {busy ? 'Uploading…' : info.hasLogo ? 'Upload a new logo' : 'Upload logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} disabled={busy} hidden />
          </label>
          {messages}
        </div>
      </div>
    </Part>
  );
}

function InfraPart({ info, schoolId, token, onSaved }: PartProps) {
  const [form, setForm] = useState({
    labCapacity: info.infra?.labCapacity ?? '',
    internetConnectivity: info.infra?.internetConnectivity ?? '',
    systemsPerStudent: info.infra?.systemsPerStudent ?? '',
  });
  const { busy, submit, messages } = useSubmit(onSaved);
  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(async () => {
      await api.saveSchoolFormInfra(schoolId, token, form);
      return 'Thank you — lab details saved.';
    });
  };
  return (
    <Part n={4} title="Computer lab & internet" done={!!info.infra} doneText="Received">
      <form onSubmit={onSubmit} className="school-part-grid">
        <p className="muted small span-all">Helps us plan the right mix of theory and practical sessions.</p>
        <label>
          Computers in the lab
          <input placeholder="e.g. 30 computers" value={form.labCapacity} onChange={set('labCapacity')} />
        </label>
        <label>
          Internet connection
          <select value={form.internetConnectivity} onChange={set('internetConnectivity')}>
            <option value="">Choose…</option>
            <option value="Good — works well">Good — works well</option>
            <option value="Slow or unreliable">Slow or unreliable</option>
            <option value="No internet in the lab">No internet in the lab</option>
          </select>
        </label>
        <label>
          Students per computer
          <input placeholder="e.g. 2" value={form.systemsPerStudent} onChange={set('systemsPerStudent')} />
        </label>
        <div className="span-all">
          <button type="submit" disabled={busy || !(form.labCapacity || form.internetConnectivity || form.systemsPerStudent)}>
            {busy ? 'Saving…' : info.infra ? 'Update lab details' : 'Save lab details'}
          </button>
          {messages}
        </div>
      </form>
    </Part>
  );
}

function OrientationPart({ info, schoolId, token, onSaved }: PartProps) {
  const [date, setDate] = useState(info.orientation?.date.slice(0, 10) ?? '');
  const [note, setNote] = useState(info.orientation?.note ?? '');
  const { busy, submit, messages } = useSubmit(onSaved);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(async () => {
      await api.saveSchoolFormOrientation(schoolId, token, { date, note });
      return 'Thank you — your account manager will confirm the session with you.';
    });
  };
  const picked = info.orientation && new Date(info.orientation.date).toLocaleDateString('en-IN', { dateStyle: 'long' });
  return (
    <Part n={5} title="Orientation date" done={!!info.orientation} doneText={picked ?? 'Done'}>
      <form onSubmit={onSubmit} className="school-part-grid">
        <p className="muted small span-all">
          Pick a day that suits you for the leadership orientation and teacher induction session. Your account manager will confirm it.
        </p>
        <label>
          Preferred date
          <input type="date" min={tomorrow()} value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Preferred time or note (optional)
          <input placeholder="e.g. 10 AM, after assembly" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>
        <div className="span-all">
          <button type="submit" disabled={busy || !date}>
            {busy ? 'Saving…' : info.orientation ? 'Change date' : 'Save date'}
          </button>
          {messages}
        </div>
      </form>
    </Part>
  );
}
