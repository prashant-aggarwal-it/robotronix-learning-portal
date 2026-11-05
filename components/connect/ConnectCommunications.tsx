"use client";
import {useCallback,useEffect,useState} from "react";
import {connectFetch} from "@/lib/connect-client";
type Alert={id:string;title:string;taskId:string;kind:"upcoming"|"overdue";createdAt:string;readAt:string|null};
type Message={id:string;conversation_id:string;person_id:string|null;person_name:string|null;
 provider:string;channel_name:string;direction:"inbound"|"outbound";body:string|null;delivery_status:string;occurred_at:string};
function stamp(v:string){return new Date(v).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});}
export function ConnectReminderInbox({tenantId}:{tenantId:string}){
 const[alerts,setAlerts]=useState<Alert[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{
  try{
   const r=await connectFetch<{notifications:Alert[]}>("/api/connect/workspaces/"+tenantId+"/inbox");
   setAlerts(r.notifications||[]);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load reminders.");}
 },[tenantId]);
 useEffect(()=>{setAlerts([]);void load();},[load]);
 async function read(id:string){
  if(busy)return;setBusy(true);
  try{
   const r=await connectFetch<{notifications:Alert[]}>("/api/connect/workspaces/"+tenantId+"/inbox",{
    method:"PATCH",body:JSON.stringify({notificationId:id})
   });setAlerts(r.notifications);
  }catch(e){setError(e instanceof Error?e.message:"Unable to acknowledge reminder.");}
  finally{setBusy(false);}
 }
 return <section className="cx-panel">
  <div className="cx-panel-header"><div><h2>My reminders</h2><p>Follow-ups assigned to you. New alerts appear when the reminder scheduler runs.</p></div>
   <button className="cx-secondary" type="button" onClick={()=>void load()}>Refresh</button></div>
  <div className="cx-automation-list">
   {error&&<div className="cx-alert" role="alert">{error}</div>}
   {!alerts.length&&<p className="cx-muted">No upcoming or overdue reminders yet.</p>}
   {alerts.map(a=><div className={"cx-alert-item "+(a.readAt?"cx-read":"")} key={a.id}>
    <div><strong>{a.title}</strong><small>{stamp(a.createdAt)} · {a.kind==="overdue"?"Overdue":"Due soon"}</small></div>
    {!a.readAt?<button className="cx-secondary" disabled={busy} onClick={()=>void read(a.id)}>Mark read</button>:
    <span className="cx-status won">Read</span>}
   </div>)}
  </div>
 </section>;
}

export function ConnectConversationHistory({tenantId,personId,compact=false}:{tenantId:string;personId?:string|null;compact?:boolean}){
 const[messages,setMessages]=useState<Message[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const q=new URLSearchParams({limit:compact?"30":"100"});
   if(personId)q.set("personId",personId);
   const r=await connectFetch<{messages:Message[]}>("/api/connect/workspaces/"+tenantId+"/conversations?"+q);
   setMessages(r.messages||[]);
  }catch(e){setError(e instanceof Error?e.message:"Conversation history unavailable.");}
  finally{setLoading(false);}
 },[tenantId,personId,compact]);
 useEffect(()=>{setMessages([]);void load();},[load]);
 return <section className={compact?"cx-detail-card":"cx-panel"}>
  <div className={compact?"":"cx-panel-header"}><div><h3>{compact?"Conversation history":"Communication history"}</h3>
   {!compact&&<p className="cx-muted">Inbound WhatsApp and email events across your institute. No outbound messages are sent automatically.</p>}</div>
   <button className="cx-text-button" type="button" onClick={()=>void load()}>Refresh</button></div>
  <div className="cx-automation-list">
   {error&&<div className="cx-alert" role="alert">{error}</div>}
   {loading?<p className="cx-muted">Loading conversations…</p>:
    !messages.length?<p className="cx-muted">No conversation messages recorded yet.</p>:
    messages.map(m=><article className="cx-message" key={m.id}>
     <div className="cx-message-head"><strong>{m.person_name||"Unknown contact"}</strong>
      <span>{m.provider==="whatsapp"?"WhatsApp":m.provider==="email"?"Email":m.provider} · {stamp(m.occurred_at)}</span></div>
     <p>{m.body||"Message details unavailable"}</p>
     <small>{m.direction==="inbound"?"Received":"Sent"} · {m.channel_name}</small>
    </article>)}
  </div>
 </section>;
}
