import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import Icon from "./Icon.jsx";

const TYPE_ICONS = {
  pending_verification: "pending_actions",
  corrections_requested: "rule_folder",
  certificate_expiring: "notification_important",
  incomplete_profile: "person_alert",
  achievement_verified: "verified",
  report_generated: "description",
};

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef(null);

  const loadUnread = () => {
    api.get("/notifications/unread_count/").then(({ data }) => setUnread(data.count));
  };

  const loadList = () => {
    api.get("/notifications/", { params: { page_size: 20 } }).then(({ data }) => setItems(data.results ?? data));
  };

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 45_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) loadList();
  }, [open]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const markRead = async (notification) => {
    if (notification.is_read) return;
    await api.post(`/notifications/${notification.id}/mark_read/`);
    setItems((list) => list.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await api.post("/notifications/mark-all-read/");
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
        aria-label="Notifications"
      >
        <Icon name="notifications" size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-[3px] rounded-full bg-blue-600 ring-2 ring-white text-white text-[10px] font-bold grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-card-lg z-20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="font-semibold text-sm text-slate-900">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n)}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition ${!n.is_read ? "bg-blue-50/40" : ""}`}
              >
                <span className={`h-8 w-8 shrink-0 rounded-lg grid place-items-center ${!n.is_read ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
                  <Icon name={TYPE_ICONS[n.notification_type] || "notifications"} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900 truncate">{n.title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</span>
                  <span className="block text-[11px] text-slate-400 mt-1">{timeAgo(n.created_at)}</span>
                </span>
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />}
              </button>
            ))}
            {items.length === 0 && <p className="text-sm text-slate-400 px-4 py-8 text-center">No notifications yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
