import { useEffect, useState } from 'react';
import { TrainingMode } from '@b2b-ops/shared';
import { api, School, staffSession } from '../../lib/api';
import { Modal } from '../../components/Modal';

const FIELDS = [
  ['name', 'School name'],
  ['ownerName', 'Owner name'],
  ['ownerDesignation', 'Owner designation'],
  ['ownerEmail', 'Owner email'],
  ['ownerPhone', 'Owner phone'],
  ['city', 'District / city'],
  ['state', 'State'],
  ['productProgram', 'Product / program'],
  ['gradeFrom', 'Grade from'],
  ['gradeTo', 'Grade to'],
] as const;

type Field = (typeof FIELDS)[number][0];

// Fixes the details that matter after the Sales handover — above all the
// owner email (where every school email goes) and the account manager
// (who those emails come from). Covers every field the checklist agent
// needs to tick the handover tasks, so a school saved with blanks isn't
// stuck in Phase 1.
export function EditSchoolModal({ school, onSaved, onClose }: { school: School; onSaved: (s: School) => void; onClose: () => void }) {
  const [form, setForm] = useState<Record<Field, string>>(() => {
    const initial = {} as Record<Field, string>;
    for (const [key] of FIELDS) initial[key] = school[key] ?? '';
    return initial;
  });
  const [workshopsCommitted, setWorkshopsCommitted] = useState(school.workshopsCommitted?.toString() ?? '');
  const [trainingMode, setTrainingMode] = useState<TrainingMode | ''>(school.trainingMode ?? '');
  const [managerId, setManagerId] = useState(school.assignedAccountManagerId ?? '');
  const [accountManagers, setAccountManagers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Account managers only see their own schools, so the backend won't let
  // them reassign one — don't offer it.
  const canReassign = staffSession.get()?.role !== 'ACCOUNT_MANAGER';

  useEffect(() => {
    api.listAccountManagers().then(setAccountManagers).catch(() => setAccountManagers([]));
  }, []);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const dto: Partial<School> = {};
      // Blank means "clear it" (null) — an empty string would fail the
      // backend's email validation.
      for (const [key] of FIELDS) {
        if (key === 'name') dto.name = form.name.trim();
        else dto[key] = form[key].trim() || null;
      }
      dto.workshopsCommitted = workshopsCommitted.trim() === '' ? null : Number(workshopsCommitted);
      dto.trainingMode = trainingMode || null;
      if (canReassign) dto.assignedAccountManagerId = managerId || null;
      await api.updateSchool(school.id, dto);
      onSaved(await api.getSchool(school.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit school"
      confirmLabel={saving ? 'Saving…' : 'Save changes'}
      onConfirm={save}
      onCancel={onClose}
      confirmDisabled={saving || !form.name.trim()}
    >
      {FIELDS.map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type={key === 'ownerEmail' ? 'email' : 'text'}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </label>
      ))}
      <label>
        Workshops committed
        <input type="number" min={0} value={workshopsCommitted} onChange={(e) => setWorkshopsCommitted(e.target.value)} />
      </label>
      <label>
        Training mode
        <select value={trainingMode} onChange={(e) => setTrainingMode(e.target.value as TrainingMode | '')}>
          <option value="">—</option>
          <option value={TrainingMode.ONLINE}>Online</option>
          <option value={TrainingMode.OFFLINE}>Offline</option>
        </select>
      </label>
      <label>
        Account manager
        <select value={managerId} onChange={(e) => setManagerId(e.target.value)} disabled={!canReassign}>
          <option value="">Unassigned</option>
          {/* Keep the current manager selectable even if they're no longer an active AM. */}
          {school.assignedAccountManager && !accountManagers.some((m) => m.id === school.assignedAccountManager!.id) && (
            <option value={school.assignedAccountManager.id}>{school.assignedAccountManager.name}</option>
          )}
          {accountManagers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
