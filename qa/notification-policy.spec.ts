import { test, expect } from "@playwright/test";
import { activeGroups, activeUnreadCount, groupNotifications, isActiveNotification } from "../lib/notification-policy";
import type { PortalNotification } from "../lib/types";

const now = Date.parse("2026-11-04T12:00:00Z");
function note(id: string, overrides: Partial<PortalNotification> = {}): PortalNotification {
  return {
    id, recipientRole: "trainer", type: "class_scheduled",
    priority: "info", title: "Class scheduled", message: "A learning session has been scheduled.",
    href: "/trainer/schedule", createdAt: "2026-11-04T10:00:00Z",
    ...overrides,
  };
}

test.describe("Notification lifecycle across roles", () => {
  test("groups routine schedule events for one recipient and one day", () => {
    const rows = [note("a"), note("b"), note("c")];
    const groups = activeGroups(rows, now);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].notification.title).toBe("3 classes scheduled");
    expect(activeUnreadCount(rows, now)).toBe(1);
  });

  test("never groups distinct learners, trainers or days together", () => {
    const rows = [
      note("a", { studentId: "student1" }),
      note("b", { studentId: "student2" }),
      note("c", { trainerId: "trainer2" }),
      note("d", { createdAt: "2026-11-03T10:00:00Z" }),
    ];
    expect(groupNotifications(rows)).toHaveLength(4);
  });

  test("moves old routine updates into history without deleting them", () => {
    const recent = note("recent");
    const old = note("old", { createdAt: "2026-10-20T10:00:00Z" });
    expect(isActiveNotification(old, now)).toBe(false);
    expect(activeGroups([recent, old], now)).toHaveLength(1);
    expect(groupNotifications([recent, old])).toHaveLength(2);
  });

  test("retains important and actionable notifications irrespective of age", () => {
    const oldAction = note("action", { type: "attendance_update_pending", priority: "action", createdAt: "2026-09-01T10:00:00Z" });
    const oldImportant = note("important", { type: "class_cancelled", priority: "important", createdAt: "2026-09-01T10:00:00Z" });
    expect(activeGroups([oldAction, oldImportant], now)).toHaveLength(2);
  });

  test("treats legacy parent scheduled-action notifications as routine", () => {
    const oldParent = note("parent", { recipientRole: "parent", priority: "action", createdAt: "2026-10-01T10:00:00Z" });
    expect(isActiveNotification(oldParent, now)).toBe(false);
    expect(groupNotifications([oldParent])[0].notification.priority).toBe("info");
  });

  test("keeps unread group until all underlying notifications are read", () => {
    const rows = [note("read", { readAt: "2026-11-04T11:00:00Z" }), note("unread")];
    expect(activeUnreadCount(rows, now)).toBe(1);
    expect(activeUnreadCount(rows.map(n => ({ ...n, readAt: "2026-11-04T11:00:00Z" })), now)).toBe(0);
  });

  test("works for all four roles with independent groups", () => {
    const rows = (["admin", "trainer", "parent", "student"] as const)
      .map((recipientRole, i) => note(String(i), { recipientRole }));
    expect(activeUnreadCount(rows, now)).toBe(4);
  });
});
