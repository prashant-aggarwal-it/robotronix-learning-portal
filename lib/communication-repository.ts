"use client";

import { getSupabaseBrowserClient } from "./supabase/browser";
import { demoMessages, demoNotifications, demoThreads } from "./communication-demo-data";
import {demoStore} from "./demo-store";
import {zonedLocalToUtc} from "./timezones";
import type {
  CommunicationCategory,
  CommunicationMessage,
  CommunicationThread,
  CommunicationThreadStatus,
  PortalNotification,
  UserRole,
} from "./types";

const K = {
  notifications: "robotronix_v11_notifications",
  threads: "robotronix_v11_threads",
  messages: "robotronix_v11_messages",
};

const LOCAL_EVENT = "robotronix:communication-change";
export type LiveConnectionStatus = "connecting" | "live" | "offline";

type ChangeHandler = () => void;
type StatusHandler = (status: LiveConnectionStatus) => void;

function read<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    window.localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function write<T>(key: string, rows: T[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: { key } }));
  }
  return rows;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function subscribeLocal(keys: string[], onChange: ChangeHandler, onStatus?: StatusHandler) {
  if (typeof window === "undefined") return () => undefined;
  onStatus?.("live");
  const custom = (event: Event) => {
    const key = (event as CustomEvent<{ key?: string }>).detail?.key;
    if (!key || keys.includes(key)) onChange();
  };
  const storage = (event: StorageEvent) => {
    if (event.key && keys.includes(event.key)) onChange();
  };
  window.addEventListener(LOCAL_EVENT, custom);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(LOCAL_EVENT, custom);
    window.removeEventListener("storage", storage);
  };
}

function mapRealtimeStatus(status: string): LiveConnectionStatus {
  if (status === "SUBSCRIBED") return "live";
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") return "offline";
  return "connecting";
}

function channelSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribeNotifications(role: UserRole, onChange: ChangeHandler, onStatus?: StatusHandler) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return subscribeLocal([K.notifications], onChange, onStatus);

  onStatus?.("connecting");
  const channel = supabase
    .channel(`portal-notifications-${role}-${channelSuffix()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "portal_notifications", filter: `recipient_role=eq.${role}` },
      onChange,
    )
    .subscribe((status) => onStatus?.(mapRealtimeStatus(status)));

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeCommunicationThreads(onChange: ChangeHandler, onStatus?: StatusHandler) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return subscribeLocal([K.threads], onChange, onStatus);

  onStatus?.("connecting");
  const channel = supabase
    .channel(`communication-threads-${channelSuffix()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "communication_threads" }, onChange)
    .subscribe((status) => onStatus?.(mapRealtimeStatus(status)));

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeThreadMessages(threadId: string, onChange: ChangeHandler, onStatus?: StatusHandler) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return subscribeLocal([K.messages, K.threads], onChange, onStatus);

  onStatus?.("connecting");
  const messageChannel = supabase
    .channel(`communication-messages-${threadId}-${channelSuffix()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "communication_messages", filter: `thread_id=eq.${threadId}` },
      onChange,
    )
    .subscribe((status) => onStatus?.(mapRealtimeStatus(status)));

  const threadChannel = supabase
    .channel(`communication-thread-${threadId}-${channelSuffix()}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "communication_threads", filter: `id=eq.${threadId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(messageChannel);
    void supabase.removeChannel(threadChannel);
  };
}

function demoNotificationScope(role: UserRole, trainerId?: string, studentId?: string) {
  return read<PortalNotification>(K.notifications, demoNotifications).filter(
    (n) =>
      n.recipientRole === role &&
      (!trainerId || !n.trainerId || n.trainerId === trainerId) &&
      (!studentId || !n.studentId || n.studentId === studentId),
  );
}

function processDemoScheduledReminders(){
  if(typeof window==="undefined")return;
  const existing=read<PortalNotification>(K.notifications,demoNotifications);const ids=new Set(existing.map(n=>n.id));const created:PortalNotification[]=[];const now=Date.now();
  const policies=demoStore.reminderPolicies.list().filter(p=>p.enabled);const events=demoStore.schedule.list().filter(e=>e.eventType==="class"&&e.status==="scheduled");const enrollments=demoStore.enrollments.list();const attendance=demoStore.attendance.list();
  for(const event of events){const start=zonedLocalToUtc(event.date,event.startTime,event.timezone).getTime();const end=zonedLocalToUtc(event.date,event.endTime,event.timezone).getTime();const studentIds=event.studentId?[event.studentId]:event.cohortId?enrollments.filter(e=>e.cohortId===event.cohortId&&e.status==="active").map(e=>e.studentId):[];for(const policy of policies){const target=policy.eventType==="class"?start-(policy.minutesBefore??0)*60000:end+(policy.minutesAfter??0)*60000;if(now<target||now>=target+10*60000)continue;if(policy.eventType==="attendance_pending"&&attendance.some(a=>a.scheduleEventId===event.id))continue;const base={priority:(policy.eventType==="attendance_pending"?"action":"info") as "action"|"info",createdAt:new Date().toISOString(),readAt:undefined};if(policy.recipientRole==="trainer"){const nid=`demo-rem:${event.id}:${policy.id}:trainer`;if(!ids.has(nid)){created.push({...base,id:nid,recipientRole:"trainer",trainerId:event.trainerId,studentId:event.studentId,type:policy.eventType==="class"?"class_reminder":"attendance_update_pending",title:policy.eventType==="class"?"Upcoming class":"Class update pending",message:policy.eventType==="class"?`${event.title} starts in ${policy.minutesBefore} minutes.`:`${event.title} ended ${policy.minutesAfter} minutes ago. Please record attendance and learning updates.`,href:"/trainer/classes"});ids.add(nid)}}else if(policy.eventType==="class"&&(policy.recipientRole==="parent"||policy.recipientRole==="student")){for(const studentId of studentIds){const nid=`demo-rem:${event.id}:${policy.id}:${studentId}`;if(ids.has(nid))continue;created.push({...base,id:nid,recipientRole:policy.recipientRole,studentId,trainerId:event.trainerId,type:"class_reminder",title:"Class reminder",message:`Your Robotronix™ class starts in ${policy.minutesBefore} minutes.`,href:policy.recipientRole==="parent"?"/parent":"/student"});ids.add(nid)}}}}
  if(created.length)write(K.notifications,[...created,...existing]);
}

export async function listNotifications(
  role: UserRole,
  options: { trainerId?: string; studentId?: string } = {},
): Promise<PortalNotification[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    processDemoScheduledReminders();
    return demoNotificationScope(role, options.trainerId, options.studentId).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  let q = supabase.from("portal_notifications").select("*").eq("recipient_role", role).order("created_at", { ascending: false });
  if (options.trainerId) q = q.or(`trainer_id.is.null,trainer_id.eq.${options.trainerId}`);
  if (options.studentId) q = q.or(`student_id.is.null,student_id.eq.${options.studentId}`);
  const { data } = await q;
  let scoped=data??[];
  if(role==="parent"){
    const{data:{session}}=await supabase.auth.getSession();
    if(session?.user){
      const{data:parent}=await supabase.from("parents").select("id").eq("profile_id",session.user.id).maybeSingle();
      const{data:links}=parent?.id?await supabase.from("parent_students").select("student_id").eq("parent_id",parent.id):{data:[] as any[]};
      const allowed=new Set((links??[]).map((x:any)=>x.student_id));
      scoped=scoped.filter((r:any)=>r.recipient_profile_id===session.user.id||(r.student_id&&allowed.has(r.student_id)));
    }
  }
  return scoped.map((r: any) => ({
    id: r.id,
    recipientRole: r.recipient_role,
    recipientProfileId: r.recipient_profile_id ?? undefined,
    studentId: r.student_id ?? undefined,
    trainerId: r.trainer_id ?? undefined,
    type: r.type,
    priority: r.priority,
    title: r.title,
    message: r.message,
    href: r.href,
    createdAt: r.created_at,
    readAt: r.read_at ?? undefined,
  }));
}

export async function markNotificationRead(notificationId: string, isRead = true) {
  const supabase = getSupabaseBrowserClient();
  const readAt = isRead ? new Date().toISOString() : undefined;
  if (!supabase) {
    const rows = read<PortalNotification>(K.notifications, demoNotifications).map((n) =>
      n.id === notificationId ? { ...n, readAt } : n,
    );
    write(K.notifications, rows);
    return { ok: true };
  }
  const { error } = await supabase.from("portal_notifications").update({ read_at: readAt ?? null }).eq("id", notificationId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markAllNotificationsRead(role: UserRole) {
  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();
  if (!supabase) {
    const rows = read<PortalNotification>(K.notifications, demoNotifications).map((n) =>
      n.recipientRole === role ? { ...n, readAt: n.readAt ?? now } : n,
    );
    write(K.notifications, rows);
    return { ok: true };
  }
  const { error } = await supabase
    .from("portal_notifications")
    .update({ read_at: now })
    .eq("recipient_role", role)
    .is("read_at", null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function emitNotification(input: Omit<PortalNotification, "id" | "createdAt">) {
  const record: PortalNotification = { ...input, id: id("not"), createdAt: new Date().toISOString() };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const rows = read<PortalNotification>(K.notifications, demoNotifications);
    write(K.notifications, [record, ...rows]);
    return { ok: true, id: record.id };
  }
  const { data, error } = await supabase
    .from("portal_notifications")
    .insert({
      recipient_role: record.recipientRole,
      recipient_profile_id: record.recipientProfileId || null,
      student_id: record.studentId || null,
      trainer_id: record.trainerId || null,
      type: record.type,
      priority: record.priority,
      title: record.title,
      message: record.message,
      href: record.href,
    })
    .select("id")
    .single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
}

function scopeThreads(role: "admin" | "trainer" | "parent", trainerId?: string, parentId?: string) {
  const rows = read<CommunicationThread>(K.threads, demoThreads);
  if (role === "admin") return rows;
  if (role === "trainer") return rows.filter((t) => t.trainerId === (trainerId ?? "vikas"));
  return rows.filter((t) => t.parentId === (parentId ?? "demo-parent"));
}

export async function listCommunicationThreads(
  role: "admin" | "trainer" | "parent",
  options: { trainerId?: string; parentId?: string } = {},
): Promise<CommunicationThread[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return scopeThreads(role, options.trainerId, options.parentId).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

  // In live mode RLS is the authoritative scope. Optional filters only narrow data further.
  let q = supabase.from("communication_threads").select("*").order("last_message_at", { ascending: false });
  if (role === "trainer" && options.trainerId) q = q.eq("trainer_id", options.trainerId);
  if (role === "parent" && options.parentId) q = q.eq("parent_id", options.parentId);
  const { data } = await q;
  let scoped=data??[];
  if(role==="parent"){
    const{data:{session}}=await supabase.auth.getSession();
    if(session?.user){
      const{data:parent}=await supabase.from("parents").select("id").eq("profile_id",session.user.id).maybeSingle();
      const{data:links}=parent?.id?await supabase.from("parent_students").select("student_id").eq("parent_id",parent.id):{data:[] as any[]};
      const allowed=new Set((links??[]).map((x:any)=>x.student_id));
      scoped=scoped.filter((r:any)=>r.recipient_profile_id===session.user.id||(r.student_id&&allowed.has(r.student_id)));
    }
  }
  return scoped.map((r: any) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    subject: r.subject,
    studentId: r.student_id ?? undefined,
    studentName: r.student_name ?? undefined,
    parentId: r.parent_id ?? undefined,
    parentName: r.parent_name ?? undefined,
    trainerId: r.trainer_id ?? undefined,
    trainerName: r.trainer_name ?? undefined,
    assignedTo: r.assigned_to ?? undefined,
    lastMessageAt: r.last_message_at,
    lastMessagePreview: r.last_message_preview ?? "",
    unreadAdmin: r.unread_admin ?? 0,
    unreadParent: r.unread_parent ?? 0,
    unreadTrainer: r.unread_trainer ?? 0,
    createdAt: r.created_at,
  }));
}

export async function getCommunicationThread(
  idValue: string,
  role: "admin" | "trainer" | "parent",
  options: { trainerId?: string; parentId?: string } = {},
): Promise<CommunicationThread | null> {
  const rows = await listCommunicationThreads(role, options);
  return rows.find((t) => t.id === idValue) ?? null;
}

export async function listThreadMessages(threadId: string): Promise<CommunicationMessage[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return read<CommunicationMessage>(K.messages, demoMessages)
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const { data } = await supabase.from("communication_messages").select("*").eq("thread_id", threadId).order("created_at");
  return (data ?? []).map((r: any) => ({
    id: r.id,
    threadId: r.thread_id,
    senderRole: r.sender_role,
    senderName: r.sender_name,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function createCommunicationThread(input: {
  category: CommunicationCategory;
  subject: string;
  studentId?: string;
  studentName?: string;
  parentId?: string;
  parentName?: string;
  trainerId?: string;
  trainerName?: string;
  message: string;
  senderRole: "admin" | "parent" | "trainer";
  senderName: string;
}) {
  const now = new Date().toISOString();
  const demoFamilyParent = input.studentId && ["aarav-mehta", "riya-kapoor"].includes(input.studentId)
    ? "demo-parent"
    : input.studentId
      ? `parent-${input.studentId}`
      : undefined;

  const thread: CommunicationThread = {
    id: id("thread"),
    category: input.category,
    status: input.senderRole === "parent" ? "waiting_team" : "waiting_parent",
    subject: input.subject,
    studentId: input.studentId,
    studentName: input.studentName,
    parentId: input.parentId ?? (input.senderRole === "parent" ? "demo-parent" : demoFamilyParent),
    parentName: input.parentName ?? (input.senderRole === "parent" ? "Family account" : undefined),
    trainerId: input.trainerId,
    trainerName: input.trainerName,
    assignedTo: "Learning Support",
    lastMessageAt: now,
    lastMessagePreview: input.message,
    unreadAdmin: input.senderRole === "parent" ? 1 : 0,
    unreadParent: input.senderRole !== "parent" ? 1 : 0,
    unreadTrainer: input.senderRole === "parent" && Boolean(input.trainerId) ? 1 : 0,
    createdAt: now,
  };
  const message: CommunicationMessage = {
    id: id("msg"),
    threadId: thread.id,
    senderRole: input.senderRole,
    senderName: input.senderName,
    body: input.message,
    createdAt: now,
  };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    write(K.threads, [thread, ...read<CommunicationThread>(K.threads, demoThreads)]);
    write(K.messages, [...read<CommunicationMessage>(K.messages, demoMessages), message]);
    const ns = read<PortalNotification>(K.notifications, demoNotifications);
    const created: PortalNotification[] = [];
    if (input.senderRole === "parent") {
      created.push({
        id: id("not"), recipientRole: "admin", studentId: input.studentId, trainerId: input.trainerId,
        type: "message_received", priority: "action", title: "Parent message awaiting response", message: input.message,
        href: `/admin/messages/${thread.id}`, createdAt: now,
      });
      if (input.trainerId) {
        created.push({
          id: id("not"), recipientRole: "trainer", studentId: input.studentId, trainerId: input.trainerId,
          type: "message_received", priority: "action", title: "Parent message awaiting reply", message: input.message,
          href: `/trainer/messages/${thread.id}`, createdAt: now,
        });
      }
    }
    write(K.notifications, [...created, ...ns]);
    return { ok: true, id: thread.id };
  }

  let liveParentId: string | null | undefined = thread.parentId;
  if (input.senderRole === "parent") {
    const { data: p } = await supabase.from("parents").select("id").limit(1).maybeSingle();
    liveParentId = p?.id ?? null;
  } else if (input.senderRole === "admin" && !liveParentId && thread.studentId) {
    const { data: link } = await supabase.from("parent_students").select("parent_id").eq("student_id", thread.studentId).limit(1).maybeSingle();
    liveParentId = link?.parent_id ?? null;
  } else if (input.senderRole === "trainer") {
    // A database BEFORE INSERT trigger resolves the learner's family link without exposing parent data to the trainer client.
    liveParentId = null;
  }

  const { data, error } = await supabase
    .from("communication_threads")
    .insert({
      category: thread.category,
      status: thread.status,
      subject: thread.subject.trim(),
      student_id: thread.studentId || null,
      student_name: thread.studentName || null,
      parent_id: liveParentId || null,
      parent_name: thread.parentName || null,
      trainer_id: thread.trainerId || null,
      trainer_name: thread.trainerName || null,
      assigned_to: thread.assignedTo,
      last_message_at: now,
      last_message_preview: input.message.trim(),
      unread_admin: 0,
      unread_parent: 0,
      unread_trainer: 0,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // The database trigger is the live-mode source of truth for thread metadata, unread counts and notifications.
  const { error: msgError } = await supabase.from("communication_messages").insert({
    thread_id: data.id,
    sender_role: message.senderRole,
    sender_name: message.senderName,
    body: message.body.trim(),
  });
  return msgError ? { ok: false, error: msgError.message } : { ok: true, id: data.id };
}

export async function sendCommunicationMessage(input: {
  threadId: string;
  senderRole: "admin" | "trainer" | "parent";
  senderName: string;
  body: string;
}) {
  const now = new Date().toISOString();
  const body = input.body.trim();
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    const msg: CommunicationMessage = {
      id: id("msg"), threadId: input.threadId, senderRole: input.senderRole, senderName: input.senderName, body, createdAt: now,
    };
    write(K.messages, [...read<CommunicationMessage>(K.messages, demoMessages), msg]);
    const current = read<CommunicationThread>(K.threads, demoThreads);
    const target = current.find((t) => t.id === input.threadId);
    const rows = current.map((t) =>
      t.id === input.threadId
        ? {
            ...t,
            lastMessageAt: now,
            lastMessagePreview: msg.body,
            status: input.senderRole === "parent" ? "waiting_team" as const : "waiting_parent" as const,
            unreadAdmin: input.senderRole === "parent" ? t.unreadAdmin + 1 : t.unreadAdmin,
            unreadParent: input.senderRole === "parent" ? t.unreadParent : t.unreadParent + 1,
            unreadTrainer: input.senderRole === "parent" ? t.unreadTrainer + 1 : t.unreadTrainer,
          }
        : t,
    );
    write(K.threads, rows);
    if (target) {
      const ns = read<PortalNotification>(K.notifications, demoNotifications);
      const created: PortalNotification[] = [];
      if (input.senderRole === "parent") {
        created.push({
          id: id("not"), recipientRole: "admin", studentId: target.studentId, trainerId: target.trainerId,
          type: "message_received", priority: "action", title: "Parent message awaiting response", message: msg.body,
          href: `/admin/messages/${input.threadId}`, createdAt: now,
        });
        if (target.trainerId) {
          created.push({
            id: id("not"), recipientRole: "trainer", studentId: target.studentId, trainerId: target.trainerId,
            type: "message_received", priority: "action", title: "Parent message awaiting reply", message: msg.body,
            href: `/trainer/messages/${input.threadId}`, createdAt: now,
          });
        }
      } else {
        created.push({
          id: id("not"), recipientRole: "parent", studentId: target.studentId, trainerId: target.trainerId,
          type: "message_received", priority: "action", title: "New message from Robotronix™", message: msg.body,
          href: `/parent/messages/${input.threadId}`, createdAt: now,
        });
      }
      write(K.notifications, [...created, ...ns]);
    }
    return { ok: true };
  }

  // No direct thread update here: the database trigger performs the atomic metadata/unread update.
  const { error } = await supabase.from("communication_messages").insert({
    thread_id: input.threadId,
    sender_role: input.senderRole,
    sender_name: input.senderName,
    body,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateThreadStatus(threadId: string, status: CommunicationThreadStatus) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    write(K.threads, read<CommunicationThread>(K.threads, demoThreads).map((t) => (t.id === threadId ? { ...t, status } : t)));
    return { ok: true };
  }

  // v1.2 uses a constrained RPC so non-admin users cannot edit arbitrary thread columns.
  const { error } = await supabase.rpc("set_communication_thread_status", { p_thread_id: threadId, p_status: status });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markThreadRead(threadId: string, role: "admin" | "trainer" | "parent") {
  const supabase = getSupabaseBrowserClient();
  const key = role === "admin" ? "unreadAdmin" : role === "trainer" ? "unreadTrainer" : "unreadParent";
  if (!supabase) {
    const current = read<CommunicationThread>(K.threads, demoThreads);
    const target = current.find((t) => t.id === threadId);
    if (!target || target[key] === 0) return { ok: true };
    write(K.threads, current.map((t) => (t.id === threadId ? { ...t, [key]: 0 } : t)));
    return { ok: true };
  }

  const { error } = await supabase.rpc("mark_communication_thread_read", { p_thread_id: threadId });
  return error ? { ok: false, error: error.message } : { ok: true };
}
