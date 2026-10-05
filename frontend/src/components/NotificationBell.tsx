import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, StaffNotification, StaffNotificationList } from '../lib/api';
import { BellIcon } from './icons';

const POLL_MS = 60_000;

const KIND_ICON: Record<StaffNotification['kind'], string> = {
  WORKSHOP_CONFIRMED: '✅',
  WORKSHOP_MOVED: '📅',
  WORKSHOP_DATES_UNAVAILABLE: '↩️',
  WORKSHOP_NEEDS_MANAGER: '⚠️',
  SCHOOL_HOLIDAY_ADDED: '🏖️',
  SCHOOL_HOLIDAY_CLASH: '⚠️',
  WORKSHOPS_AUTO_SCHEDULED: '🗓️',
  WORKSHOP_REQUESTED: '🙋',
  FESTIVAL_CLASH: '🪔',
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Top-bar bell: what schools and agents did without anyone in the tool
// doing it (a school confirmed or moved a workshop, or marked a holiday).
// Checks every minute and whenever the tab comes back into focus; opening
// it marks all as seen, while items that were new stay highlighted until
// it's closed.
export function NotificationBell() {
  const navigate = useNavigate();
  const [data, setData] = useState<StaffNotificationList | null>(null);
  const [open, setOpen] = useState(false);
  const [newSince, setNewSince] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function load() {
    api.listStaffNotifications().then(setData).catch(() => undefined);
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    window.addEventListener('focus', load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setNewSince(data?.seenAt ?? '1970-01-01T00:00:00Z');
    if (data && data.unread > 0) {
      setData({ ...data, unread: 0 });
      api.markStaffNotificationsSeen().catch(() => undefined);
    }
  }

  function openItem(n: StaffNotification) {
    setOpen(false);
    navigate(n.kind.startsWith('SCHOOL_HOLIDAY') ? '/calendar' : `/schools/${n.schoolId}?tab=Workshops`);
  }

  const unread = data?.unread ?? 0;
  return (
    <div className="notif" ref={ref}>
      <button className="notif-button" onClick={toggle} aria-label={unread ? `${unread} new notifications` : 'Notifications'}>
        <BellIcon width={18} height={18} />
        {unread > 0 && <span className="notif-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">Notifications</div>
          {!data || data.items.length === 0 ? (
            <p className="muted small notif-empty">Nothing yet. When a school confirms or moves a workshop, or marks a holiday, you'll see it here.</p>
          ) : (
            <ul className="notif-list">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button className={`notif-item${newSince && n.createdAt > newSince ? ' new' : ''}`} onClick={() => openItem(n)}>
                    <span className="notif-icon">{KIND_ICON[n.kind] ?? '•'}</span>
                    <span>
                      <span className="notif-title">{n.title}</span>
                      {n.detail && <span className="notif-detail">{n.detail}</span>}
                      <span className="notif-time">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
