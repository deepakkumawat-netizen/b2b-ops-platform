import { useEffect, useState } from 'react';
import { PhaseTaskStatus } from '@b2b-ops/shared';
import { api, SchoolPhaseTask } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { InboxIcon } from '../../components/icons';

export function SchoolChecklistTab({ schoolId, token }: { schoolId: string; token: string }) {
  const [tasks, setTasks] = useState<SchoolPhaseTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listPhaseTasks(schoolId, token).then(setTasks).catch((err) => setError(err.message));
  }

  useEffect(reload, [schoolId]);

  async function toggle(task: SchoolPhaseTask) {
    const nextStatus = task.status === PhaseTaskStatus.DONE ? PhaseTaskStatus.PENDING : PhaseTaskStatus.DONE;
    try {
      await api.updatePhaseTask(schoolId, task.id, { status: nextStatus }, token);
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
                  {t.completedByStaff && (
                    <span className="muted small">
                      ✓ {t.completedByStaff.name} {t.completedAt ? `on ${new Date(t.completedAt).toLocaleDateString()}` : ''}
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
