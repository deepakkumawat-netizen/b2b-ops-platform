import { useEffect, useState } from 'react';
import { PhaseTaskStatus } from '@b2b-ops/shared';
import { api, SchoolPhaseTask } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { InboxIcon } from '../../components/icons';

export function SchoolChecklistTab({ schoolId }: { schoolId: string }) {
  const [tasks, setTasks] = useState<SchoolPhaseTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function reload() {
    api.listPhaseTasks(schoolId).then(setTasks).catch((err) => setError(err.message));
  }

  useEffect(reload, [schoolId]);

  async function toggle(task: SchoolPhaseTask) {
    const nextStatus = task.status === PhaseTaskStatus.DONE ? PhaseTaskStatus.PENDING : PhaseTaskStatus.DONE;
    setWarning(null);
    try {
      const result = await api.updatePhaseTask(schoolId, task.id, { status: nextStatus });
      if (result.emailSent === false) {
        setWarning(`"${task.template.label}" is marked done, but the email wasn't sent. Check the Activity tab → Emails for the reason.`);
      }
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update task');
    }
  }

  const grouped = tasks.reduce<Record<string, SchoolPhaseTask[]>>((acc, t) => {
    (acc[t.template.phase] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {warning && <p className="warning">{warning}</p>}
      <p className="muted small" style={{ marginTop: 0 }}>Click anywhere on a task to mark it done — no need to hit the checkbox exactly.</p>
      {Object.entries(grouped).map(([phase, phaseTasks]) => {
        const doneCount = phaseTasks.filter((t) => t.status === PhaseTaskStatus.DONE).length;
        return (
          <div key={phase} className="checklist-phase">
            <h3>
              <span>{phase.replace(/_/g, ' ')}</span>
              <span>
                {doneCount}/{phaseTasks.length} done
              </span>
            </h3>
            <ul className="checklist">
              {phaseTasks.map((t) => (
                <li
                  key={t.id}
                  className={`clickable-row${t.status === PhaseTaskStatus.DONE ? ' done' : ''}`}
                  onClick={() => toggle(t)}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={t.status === PhaseTaskStatus.DONE}
                      onChange={() => toggle(t)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {t.template.label}
                  </label>
                  {t.status === PhaseTaskStatus.DONE && (t.completedByStaff || t.completedAt) && (
                    // No completedByStaff on a DONE task = the checklist agent ticked it; its note says why.
                    <span className="muted small" title={t.completedByStaff ? undefined : (t.notes ?? undefined)}>
                      ✓ {t.completedByStaff?.name ?? 'Agent'}{' '}
                      {t.completedAt ? `on ${new Date(t.completedAt).toLocaleDateString()}` : ''}
                      {!t.completedByStaff && t.notes ? ` — ${t.notes.replace(/^Auto-completed: /, '')}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {tasks.length === 0 && (
        <EmptyState
          icon={<InboxIcon width={22} height={22} />}
          title="No checklist tasks found"
          text="Checklist tasks are generated automatically when a school is created."
        />
      )}
    </div>
  );
}
