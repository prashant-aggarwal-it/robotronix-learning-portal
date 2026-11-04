"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from "@/lib/communication-repository";
import { activeGroups, groupNotifications } from "@/lib/notification-policy";
import type { NotificationGroup } from "@/lib/notification-policy";
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
function notificationHref(n: PortalNotification, role: UserRole) {
  const fallback = n.href || `/${role}`;
  if (role !== "admin" || !n.trainerId) return fallback;
  const financeEvent = /finance|compliance|payout details/i.test(`${n.type} ${n.title} ${n.message}`);
  if (!financeEvent) return fallback;
  return `/admin/trainers/${encodeURIComponent(n.trainerId)}?tab=finance&review=1#trainer-finance-review`;
}

export function NotificationCenter({ role }: { role: UserRole }) {
  const router = useRouter();
  const [rows, setRows] = useState<PortalNotification[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setRows(await listNotifications(role));
  }

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeNotifications(role, () => void refresh());
    const resume = () => { if (navigator.onLine !== false) void refresh(); };
    const visibility = () => { if (document.visibilityState === "visible") resume(); };
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

  const active = useMemo(() => activeGroups(rows), [rows]);
  const history = useMemo(() => groupNotifications(rows), [rows]);
  const visible = filter === "history" ? history : active;
  const filtered = useMemo(() => visible.filter((g) => {
    const n = g.notification;
    const unread = g.members.some((member) => !member.readAt);
    return (filter === "all" || filter === "history" ||
      (filter === "unread" && unread) ||
      (filter === "action" && n.priority === "action") ||
      (filter === "important" && n.priority === "important")) &&
      `${n.title} ${n.message} ${n.type}`.toLowerCase().includes(q.toLowerCase());
  }), [visible, filter, q]);

  const unread = active.filter((g) => g.members.some((n) => !n.readAt)).length;
  const actionCount = active.filter((g) => g.notification.priority === "action" && g.members.some((n) => !n.readAt)).length;
  const importantCount = active.filter((g) => g.notification.priority === "important" && g.members.some((n) => !n.readAt)).length;

  async function openGroup(g: NotificationGroup) {
    setError("");
    const toRead = g.members.filter((n) => !n.readAt);
    if (!toRead.length) return;
    const results = await Promise.all(toRead.map((n) => markNotificationRead(n.id)));
    if (results.some((result) => !result.ok)) {
      setError("Some notifications could not be marked as read. Please retry.");
      return;
    }
    const ids = new Set(toRead.map((n) => n.id));
    const now = new Date().toISOString();
    setRows((prev) => prev.map((n) => ids.has(n.id) ? { ...n, readAt: now } : n));
  }
  async function readAll() {
    setError("");
    const result = await markAllNotificationsRead(role);
    if (!result.ok) {
      setError("Unable to mark notifications as read. Please retry.");
      return;
    }
    await refresh();
  }

  return (
    <>
      <section className="communicationSummary">
        <div>
          <span className="eyebrow">NOTIFICATION CENTER</span>
          <h2>{unread ? `${unread} new notification${unread === 1 ? "" : "s"}` : "You’re up to date"}</h2>
          <p>Actions and important updates stay visible. Routine updates older than seven days remain available in History.</p>
          <div className="notificationSummaryPills">
            <span><b>{unread}</b> unread</span>
            <span><b>{actionCount}</b> action</span>
            <span><b>{importantCount}</b> important</span>
          </div>
        </div>
        {unread > 0 && <button className="button ghost" onClick={() => void readAll()}>Mark all as read</button>}
      </section>
      <section className="dataSection notificationPanel">
        <div className="dataToolbar">
          <div className="toolbarSearch"><input className="input" placeholder="Search notifications…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input compactInput" aria-label="Filter notifications" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Active notifications</option>
            <option value="unread">Unread</option>
            <option value="action">Action required</option>
            <option value="important">Important</option>
            <option value="history">All history</option>
          </select>
        </div>
        {error && <p role="alert" style={{ padding: "8px 16px" }}>{error}</p>}
        <div className="notificationList">
          {filtered.length ? filtered.map((g) => {
            const n = g.notification;
            const isUnread = g.members.some((member) => !member.readAt);
            const href = notificationHref(n, role);
            return (
              <Link href={href} key={n.id} className={`notificationItem ${isUnread ? "unread" : ""}`}
                onClick={(e) => {
                  // Prevent navigation from interrupting marking all entries in a group.
                  e.preventDefault();
                  void openGroup(g).then(() => router.push(href));
                }}>
                <span className={`notificationType priority-${n.priority}`}>{n.priority === "action" ? "!" : n.priority === "important" ? "◆" : "•"}</span>
                <div className="notificationBody">
                  <div className="notificationMeta"><span>{g.count > 1 ? "Schedule summary" : typeLabel(n.type)}</span><time>{timeLabel(n.createdAt)}</time></div>
                  <h3>{n.title}</h3><p>{n.message}</p>
                </div>
                <span className="notificationArrow">→</span>
              </Link>
            );
          }) : <div className="experienceEmpty compact notificationEmpty"><div className="experienceEmptyIcon">✓</div><h3>Nothing needs attention here</h3><p>No notifications match the selected view.</p></div>}
        </div>
      </section>
    </>
  );
}
