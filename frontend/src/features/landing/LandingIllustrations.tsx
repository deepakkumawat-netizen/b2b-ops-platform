import type { ReactNode } from 'react';

// Product "screenshots" for the landing page, drawn as plain HTML/CSS
// mockups rather than image files — they stay crisp at any size, follow the
// app's own color tokens, and add nothing to the bundle's asset payload.
// Content is illustrative sample data, not live records.

function WindowChrome({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ill-window" aria-hidden="true">
      <div className="ill-window-bar">
        <span />
        <span />
        <span />
        <em>{title}</em>
      </div>
      <div className="ill-window-body">{children}</div>
    </div>
  );
}

/** Hero: a miniature of the dashboard — stat tiles, phase distribution, and
 * a few school rows with their SOP progress. */
export function DashboardIllustration() {
  const bars = [62, 88, 48, 70, 40, 55, 76, 92, 34, 58];
  const schools = [
    { name: 'Greenwood Public School', phase: 'Teacher Training', pct: 70 },
    { name: 'St. Mary’s Convent', phase: 'Onboarding Setup', pct: 40 },
    { name: 'Delhi Heritage Academy', phase: 'Annual Renewal', pct: 100 },
  ];
  return (
    <WindowChrome title="Dashboard">
      <div className="ill-stats">
        {[
          ['Active schools', '48'],
          ['Workshops this week', '12'],
          ['Renewals due', '6'],
        ].map(([label, value]) => (
          <div key={label} className="ill-stat">
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="ill-panel">
        <small>Schools by phase</small>
        <div className="ill-bars">
          {bars.map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="ill-panel">
        {schools.map((s) => (
          <div key={s.name} className="ill-row">
            <div>
              <b>{s.name}</b>
              <small>{s.phase}</small>
            </div>
            <div className="ill-progress">
              <span style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </WindowChrome>
  );
}

/** Feature: the per-school checklist with owner roles. */
export function ChecklistIllustration() {
  const tasks = [
    { label: 'Welcome email sent', role: 'AM', done: true },
    { label: 'Welcome call made', role: 'AM', done: true },
    { label: 'Orientation session scheduled', role: 'Ops', done: true },
    { label: 'LMS credentials generated', role: 'Ops', done: false },
    { label: 'Teacher list collected', role: 'AM', done: false },
  ];
  return (
    <WindowChrome title="Greenwood Public School · Checklist">
      <div className="ill-phase-head">
        <b>Phase 4 of 10 · Onboarding Setup</b>
        <div className="ill-progress">
          <span style={{ width: '40%' }} />
        </div>
      </div>
      <ul className="ill-tasks">
        {tasks.map((t) => (
          <li key={t.label} className={t.done ? 'done' : ''}>
            <span className="ill-check">{t.done ? '✓' : ''}</span>
            <span className="ill-task-label">{t.label}</span>
            <span className="ill-chip">{t.role}</span>
          </li>
        ))}
      </ul>
    </WindowChrome>
  );
}

/** Feature: an AI-drafted follow-up waiting for review. */
export function AiDraftIllustration() {
  return (
    <WindowChrome title="AI Suggestions">
      <div className="ill-ai-card">
        <div className="ill-ai-head">
          <span className="ill-chip ill-chip-ai">✦ Engagement agent</span>
          <small>St. Mary’s Convent</small>
        </div>
        <b>Quick check-in this week?</b>
        <p>
          Hi Mrs. Sharma, it’s been a few weeks since our last visit — we’d love to drop by and see how the
          coding lab sessions are going…
        </p>
        <small className="ill-ai-why">Why: no monthly visit logged in 34 days.</small>
        <div className="ill-ai-actions">
          <span className="ill-btn">Approve &amp; send</span>
          <span className="ill-btn ghost">Edit</span>
          <span className="ill-btn ghost">Reject</span>
        </div>
      </div>
      <div className="ill-auto">
        <span className="ill-dot" /> Workshop reminder auto-sent · Delhi Heritage Academy
      </div>
      <div className="ill-auto">
        <span className="ill-dot warn" /> Stale phase alert · Sunrise International
      </div>
    </WindowChrome>
  );
}

/** Feature: workshops calendar + renewal pipeline side by side. */
export function RenewalIllustration() {
  const columns = [
    { title: 'Pending', items: ['Sunrise Intl.', 'Blue Bells'] },
    { title: 'Approached', items: ['St. Mary’s'] },
    { title: 'Agreed', items: ['Greenwood'] },
    { title: 'Signed', items: ['Delhi Heritage', 'Modern Vidya'] },
  ];
  return (
    <WindowChrome title="Renewals · 2026–27">
      <div className="ill-kanban">
        {columns.map((c) => (
          <div key={c.title} className="ill-kanban-col">
            <small>{c.title}</small>
            {c.items.map((i) => (
              <div key={i} className="ill-kanban-card">
                {i}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="ill-year">
        <small>Year summary · Greenwood Public School</small>
        <div className="ill-year-stats">
          <span>
            <b>8</b> workshops
          </span>
          <span>
            <b>11</b> visits
          </span>
          <span>
            <b>3</b> competitions
          </span>
        </div>
      </div>
    </WindowChrome>
  );
}
