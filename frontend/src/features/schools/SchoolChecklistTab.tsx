import { useEffect, useState } from 'react';
import { PhaseTaskStatus } from '@b2b-ops/shared';
import { api, SchoolPhaseTask } from '../../lib/api';

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
      {Object.entries(grouped).map(([phase, phaseTasks]) => (
        <div key={phase} className="checklist-phase">
          <h3>{phase.replace(/_/g, ' ')}</h3>
          <ul className="checklist">
            {phaseTasks.map((t) => (
              <li key={t.id} className={t.status === PhaseTaskStatus.DONE ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={t.status === PhaseTaskStatus.DONE} onChange={() => toggle(t)} />
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
      ))}
      {tasks.length === 0 && <p className="muted">No checklist tasks found.</p>}
    </div>
  );
}
