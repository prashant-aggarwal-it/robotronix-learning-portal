"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from "@/lib/communication-repository";
import type { PortalNotification, UserRole } from "@/lib/types";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function typeLabel(t: string) {
  return t.split("_").map((x) => x[0]?.toUpperCase() + x.slice(1)).join(" ");
}

export function NotificationCenter({ role }: { role: UserRole }) {
  const [rows, setRows] = useState<PortalNotification[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  async function refresh() {
    setRows(await listNotifications(role));
  }

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeNotifications(role, () => void refresh());
    const resume = () => { if (navigator.onLine !== false) void refresh(); };
    const visibility = () => { if (document.visibilityState === "visible") resume(); };
    // Recover unread state after missed Realtime events or browser sleep.
    const recovery = window.setInterval(resume, 60000);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      unsubscribe();
      window.clearInterval(recovery);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [role]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (n) =>
          (filter === "all" ||
            (filter === "unread" && !n.readAt) ||
            (filter === "action" && n.priority === "action") ||
            (filter === "important" && n.priority === "important")) &&
          `${n.title} ${n.message} ${n.type}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [rows, filter, q],
  );
  const unread = rows.filter((n) => !n.readAt).length;
  const actionCount = rows.filter((n) => n.priority === "action" && !n.readAt).length;
  const importantCount = rows.filter((n) => n.priority === "important" && !n.readAt).length;

  function notificationHref(n: PortalNotification) {
    const fallback = n.href || `/${role}`;
    if (role !== "admin" || !n.trainerId) return fallback;
    const financeEvent = /finance|compliance|payout details/i.test(`${n.type} ${n.title} ${n.message}`);
    if (!financeEvent) return fallback;
    // Keep sensitive finance data out of the URL. Only the trainer record ID is needed.
    return `/admin/trainers/${encodeURIComponent(n.trainerId)}?tab=finance&review=1#trainer-finance-review`;
  }
  async function open(n: PortalNotification) {
    if (!n.readAt) {
      await markNotificationRead(n.id);
      setRows((x) => x.map((v) => (v.id === n.id ? { ...v, readAt: new Date().toISOString() } : v)));
    }
  }
  async function readAll() {
    await markAllNotificationsRead(role);
    await refresh();
  }

  return (
    <>
      <section className="communicationSummary">
        <div>
          <span className="eyebrow">NOTIFICATION CENTER</span>
          <h2>{unread ? `${unread} item${unread === 1 ? "" : "s"} need your attention` : "You’re up to date"}</h2>
          <p>Important class, progress, project and account events appear here. Routine activity is kept quiet to reduce notification fatigue.</p>
          <div className="notificationSummaryPills"><span><b>{unread}</b> unread</span><span><b>{actionCount}</b> action</span><span><b>{importantCount}</b> important</span></div>
        </div>
        {unread > 0 && <button className="button ghost" onClick={readAll}>Mark all as read</button>}
      </section>
      <section className="dataSection notificationPanel">
        <div className="dataToolbar">
          <div className="toolbarSearch"><input className="input" placeholder="Search notifications…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input compactInput" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All notifications</option>
            <option value="unread">Unread</option>
            <option value="action">Action required</option>
            <option value="important">Important</option>
          </select>
        </div>
        <div className="notificationList">
          {filtered.length ? filtered.map((n) => (
            <Link href={notificationHref(n)} key={n.id} className={`notificationItem ${!n.readAt ? "unread" : ""}`} onClick={() => void open(n)}>
              <span className={`notificationType priority-${n.priority}`}>{n.priority === "action" ? "!" : n.priority === "important" ? "◆" : "•"}</span>
              <div className="notificationBody">
                <div className="notificationMeta"><span>{typeLabel(n.type)}</span><time>{timeLabel(n.createdAt)}</time></div>
                <h3>{n.title}</h3><p>{n.message}</p>
              </div>
              <span className="notificationArrow">→</span>
            </Link>
          )) : <div className="experienceEmpty compact notificationEmpty"><div className="experienceEmptyIcon">✓</div><h3>Nothing needs attention here</h3><p>No notifications match the selected view.</p></div>}
        </div>
      </section>
    </>
  );
}
