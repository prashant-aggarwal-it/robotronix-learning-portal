"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCommunicationThread,
  listThreadMessages,
  markThreadRead,
  sendCommunicationMessage,
  subscribeThreadMessages,
  updateThreadStatus,
  type LiveConnectionStatus,
} from "@/lib/communication-repository";
import type { CommunicationMessage, CommunicationThread, CommunicationThreadStatus } from "@/lib/types";
import { displayLabel } from "@/lib/display";

export function CommunicationThreadView({ role, threadId }: { role: "admin" | "trainer" | "parent"; threadId: string }) {
  const [thread, setThread] = useState<CommunicationThread | null>(null);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [liveStatus, setLiveStatus] = useState<LiveConnectionStatus>("connecting");
  const base = `/${role}/messages`;

  async function refresh(markRead = true) {
    const t = await getCommunicationThread(threadId, role);
    setThread(t);
    if (t) {
      setMessages(await listThreadMessages(threadId));
      if (markRead) await markThreadRead(threadId, role);
    }
  }

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeThreadMessages(
      threadId,
      () => void refresh(),
      setLiveStatus,
    );
    const resume = () => { if (navigator.onLine !== false) void refresh(); };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [threadId, role]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const senderName = role === "admin" ? "Robotronix Learning Support" : role === "trainer" ? thread?.trainerName ?? "Trainer" : thread?.parentName ?? "Parent / Guardian";
    const r = await sendCommunicationMessage({ threadId, senderRole: role, senderName, body });
    if (r.ok) {
      setBody("");
      setNotice("");
      // Realtime will normally refresh the thread; this keeps demo/offline behavior immediate too.
      await refresh();
    } else setNotice(r.error ?? "Unable to send message.");
  }

  async function status(s: CommunicationThreadStatus) {
    const r = await updateThreadStatus(threadId, s);
    if (r.ok) await refresh(false);
    else setNotice(r.error ?? "Unable to update status.");
  }

  if (!thread) {
    return <section className="card"><h2>Conversation unavailable</h2><p className="muted">This thread either does not exist or is outside your access permissions.</p><Link className="button ghost" href={base}>Back to messages</Link></section>;
  }

  return <div className="threadLayout">
    <section className="threadConversation">
      <div className="threadConversationHead">
        <div>
          <Link href={base} className="tableAction">← Messages</Link>
          <div className="threadTitleLine"><h2>{thread.subject}</h2><span className={`liveStatus live-${liveStatus}`}><i />{liveStatus === "live" ? "Live" : liveStatus === "offline" ? "Reconnecting" : "Connecting"}</span></div>
          <div className="threadTags"><span>{displayLabel(thread.category)}</span>{thread.studentName && <span>{thread.studentName}</span>}<span className={`statusBadge status-${thread.status}`}>{displayLabel(thread.status)}</span></div>
        </div>
        {role !== "parent" && thread.status !== "resolved" && <button className="button ghost" onClick={() => void status("resolved")}>Resolve conversation</button>}
        {role !== "parent" && thread.status === "resolved" && <button className="button ghost" onClick={() => void status("open")}>Reopen</button>}
      </div>
      <div className="messageStream">
        {messages.map((m) => <div className={`messageBubble ${m.senderRole === role ? "mine" : ""}`} key={m.id}>
          <div className="messageSender"><b>{m.senderName}</b><span>{m.senderRole}</span><time>{new Date(m.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</time></div>
          <p>{m.body}</p>
        </div>)}
      </div>
      {thread.status !== "resolved" ? <form className="messageComposer" onSubmit={send}>
        <textarea className="input textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write a reply…" />
        <div><span className="muted">Messages are retained with the learner support history.</span><button className="button" type="submit">Send reply</button></div>
        {notice && <div className="fieldError">{notice}</div>}
      </form> : <div className="resolvedBanner">This conversation is resolved. {role !== "parent" ? "Reopen it if further action is required." : "Start a new message if you need further assistance."}</div>}
    </section>
    <aside className="threadContext card">
      <span className="eyebrow">CONTEXT</span><h3>{thread.studentName ?? "General support"}</h3>
      {thread.parentName && <div className="contextRow"><span>Parent / Guardian</span><b>{thread.parentName}</b></div>}
      {thread.trainerName && <div className="contextRow"><span>Trainer</span><b>{thread.trainerName}</b></div>}
      <div className="contextRow"><span>Category</span><b>{thread.category}</b></div>
      <div className="contextRow"><span>Assigned to</span><b>{thread.assignedTo ?? "Learning Support"}</b></div>
      <div className="contextNote">Contact numbers and private family information are not exposed in communication threads.</div>
    </aside>
  </div>;
}
