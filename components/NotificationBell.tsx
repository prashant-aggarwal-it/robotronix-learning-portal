"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listNotifications, subscribeNotifications } from "@/lib/communication-repository";
import type { UserRole } from "@/lib/types";

export function NotificationBell({ role }: { role: UserRole }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const rows = await listNotifications(role);
      if (active) setUnread(rows.filter((n) => !n.readAt).length);
    };
    void refresh();
    const unsubscribe = subscribeNotifications(role, () => void refresh());
    const resume = () => { if (navigator.onLine !== false) void refresh(); };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [role]);

  return (
    <Link
      href={`/${role}/notifications`}
      className="notificationBell"
      aria-label={`${unread} unread notifications`}
      title="Notifications"
    >
      <span className="bellGlyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <b>Notifications</b>
      {unread > 0 && <i>{unread > 99 ? "99+" : unread}</i>}
    </Link>
  );
}
