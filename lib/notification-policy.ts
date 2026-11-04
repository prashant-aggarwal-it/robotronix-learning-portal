import type { PortalNotification } from "./types";

/**
 * A single notification policy for Admin, Trainer, Parent and Student.
 * Historical entries are never deleted. Routine informational items older
 * than seven days move out of the active inbox but remain in History.
 */
const ROUTINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type NotificationGroup = {
  notification: PortalNotification;
  members: PortalNotification[];
  count: number;
};

export function isActiveNotification(n: PortalNotification, now = Date.now()): boolean {
  if (n.priority === "action" || n.priority === "important") return true;
  const createdAt = Date.parse(n.createdAt);
  return !Number.isFinite(createdAt) || now - createdAt < ROUTINE_WINDOW_MS;
}

export function groupNotifications(rows: PortalNotification[]): NotificationGroup[] {
  const grouped = new Map<string, NotificationGroup>();
  const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const n of sorted) {
    // Keep important actions and individually changed classes fully visible.
    // Group only generic, informational per-class scheduling announcements.
    const groupable = n.type === "class_scheduled" && n.priority === "info";
    const key = groupable
      ? ["class_scheduled", n.recipientRole, n.studentId || "", n.trainerId || "", n.createdAt.slice(0, 10)].join(":")
      : n.id;
    const existing = grouped.get(key);
    if (existing) {
      existing.members.push(n);
      existing.count += 1;
    } else {
      grouped.set(key, { notification: n, members: [n], count: 1 });
    }
  }
  return [...grouped.values()].map((g) => {
    if (g.count === 1) return g;
    const unread = g.members.some((m) => !m.readAt);
    return {
      ...g,
      notification: {
        ...g.notification,
        title: `${g.count} classes scheduled`,
        message: "Class dates were added to the timetable. Open the schedule to review them.",
        readAt: unread ? undefined : g.notification.readAt || g.members[0]?.readAt,
      },
    };
  });
}

export function activeGroups(rows: PortalNotification[], now = Date.now()): NotificationGroup[] {
  return groupNotifications(rows.filter((n) => isActiveNotification(n, now)));
}

export function activeUnreadCount(rows: PortalNotification[], now = Date.now()): number {
  return activeGroups(rows, now).filter((g) => g.members.some((n) => !n.readAt)).length;
}
