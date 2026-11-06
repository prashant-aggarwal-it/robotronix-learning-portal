"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {connectFetch} from "@/features/connect/api/client";

type Cursor={at:string;id:string};
type Thread={
 id:string;channelId:string;channelName:string;personId:string|null;personName:string;phone:string|null;
 status:"open"|"pending"|"closed";assignedMemberId:string|null;lastAt:string;lastMessage:string|null;
 lastType:string|null;lastDirection:"inbound"|"outbound"|null;lastDeliveryStatus:string|null;unreadCount:number
};
type ChatMessage={
 id:string;externalId:string|null;direction:"inbound"|"outbound";body:string|null;kind:string;
 mediaId:string|null;mediaMimeType:string|null;mediaFilename:string|null;replyTo:string|null;
 deliveryStatus:string;occurredAt:string;sentAt:string|null;deliveredAt:string|null;
 readAt:string|null;failedAt:string|null;failureReason:string|null
};
type Page<T>={ok:true;items:T[];nextCursor:Cursor|null};
type Member={id:string;label:string;role:string};
type Details={conversationId:string;personId:string|null;status:"open"|"pending"|"closed";
 assignedMemberId:string|null;draft:string;lastReadAt:string|null;canWrite:boolean;canAssign:boolean;team:Member[]};
type ContactOption={id:string;name:string;phone:string|null};
type SendReady={ok:true;canSend:boolean;testMode:boolean;reason:string|null;lastInboundAt:string|null};
type ChannelHealth={channelId:string;name:string;status:string;syncContacts:number;historicalMessages:number;lastMessageAt:string|null};
const base=(tenantId:string)=>"/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/whatsapp";
function shortDate(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?"—":
 date.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});}
function clock(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?"—":
 date.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"});}
function labelType(value:string|null){return (value||"message").replaceAll("_"," ").replace(/^./,c=>c.toUpperCase());}
function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||"").join("")||"WA";}
function addUnique<T extends {id:string}>(old:T[],more:T[]){const ids=new Set(old.map(x=>x.id));return [...old,...more.filter(item=>!ids.has(item.id))];}
export function ConnectWhatsAppInbox({tenantId,canWrite,onOpenContact}:{
 tenantId:string;canWrite:boolean;onOpenContact?:(personId:string)=>void;
}){
 const [threads,setThreads]=useState<Thread[]>([]),[threadCursor,setThreadCursor]=useState<Cursor|null>(null);
 const [selected,setSelected]=useState<string|null>(null);
 const [messages,setMessages]=useState<ChatMessage[]>([]),[messageCursor,setMessageCursor]=useState<Cursor|null>(null);
 const [details,setDetails]=useState<Details|null>(null);
 const [threadLoading,setThreadLoading]=useState(true),[threadMore,setThreadMore]=useState(false);
 const [chatLoading,setChatLoading]=useState(false),[messageMore,setMessageMore]=useState(false),[busy,setBusy]=useState(false);
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[number,setNumber]=useState("all");
 const [draft,setDraft]=useState(""),[error,setError]=useState(""),[chatError,setChatError]=useState(""),[notice,setNotice]=useState("");
 const [contactQuery,setContactQuery]=useState(""),[contactMatches,setContactMatches]=useState<ContactOption[]>([]);
 const [contactSearching,setContactSearching]=useState(false),[linkOpen,setLinkOpen]=useState(false);
 const [sendReady,setSendReady]=useState<SendReady|null>(null),[sending,setSending]=useState(false);
 const [channelHealth,setChannelHealth]=useState<ChannelHealth[]>([]),[healthError,setHealthError]=useState("");
 const sendRequestId=useRef<string|null>(null);
 const threadGeneration=useRef(0),chatGeneration=useRef(0),searchGeneration=useRef(0);
 const selectedRef=useRef<string|null>(null);
 selectedRef.current=selected;
 const api=base(tenantId);
 const loadHealth=useCallback(async()=>{
  try{
   const r=await connectFetch<{ok:true;channels:ChannelHealth[]}>(api+"/health");
   setChannelHealth(r.channels);setHealthError("");
  }catch{setHealthError("Connection diagnostics unavailable.");}
 },[api]);

 const loadThreads=useCallback(async(cursor:Cursor|null=null,append=false)=>{
  const generation=++threadGeneration.current;
  if(append)setThreadMore(true);else setThreadLoading(true);
  setError("");
  try{
   const params=new URLSearchParams({limit:"40"});
   if(cursor){params.set("beforeAt",cursor.at);params.set("beforeId",cursor.id);}
   const response=await connectFetch<Page<Thread>>(api+"/threads?"+params.toString());
   if(generation!==threadGeneration.current)return;
   setThreads(previous=>append?addUnique(previous,response.items):response.items);
   setThreadCursor(response.nextCursor);
  }catch(e){if(generation===threadGeneration.current)setError(e instanceof Error?e.message:"Could not load conversations.");}
  finally{if(generation===threadGeneration.current){setThreadLoading(false);setThreadMore(false);}}
 },[api]);

 const loadMessages=useCallback(async(conversationId:string,cursor:Cursor|null=null,append=false)=>{
  const generation=++chatGeneration.current;
  if(append)setMessageMore(true);else{setChatLoading(true);setMessages([]);setMessageCursor(null);setDetails(null);}
  setChatError("");
  try{
   const params=new URLSearchParams({limit:"50"});
   if(cursor){params.set("beforeAt",cursor.at);params.set("beforeId",cursor.id);}
   const path=api+"/conversations/"+encodeURIComponent(conversationId);
   const [page,information,ready]=await Promise.all([
    connectFetch<Page<ChatMessage>>(path+"/messages?"+params.toString()),
    append?Promise.resolve(null):connectFetch<{ok:true;details:Details}>(path),
    append?Promise.resolve(null):connectFetch<SendReady>(path+"/send")
   ]);
   if(generation!==chatGeneration.current||selectedRef.current!==conversationId)return;
   setMessages(previous=>append?addUnique(previous,page.items):page.items);
   setMessageCursor(page.nextCursor);
   if(information){setDetails(information.details);setDraft(information.details.draft);}
   if(ready)setSendReady(ready);
  }catch(e){if(generation===chatGeneration.current)setChatError(e instanceof Error?e.message:"Could not load messages.");}
  finally{if(generation===chatGeneration.current){setChatLoading(false);setMessageMore(false);}}
 },[api]);

 useEffect(()=>{
  threadGeneration.current++;chatGeneration.current++;searchGeneration.current++;
  setThreads([]);setThreadCursor(null);setSelected(null);setMessages([]);setDetails(null);
  setDraft("");setSendReady(null);sendRequestId.current=null;setError("");setChatError("");setQuery("");setFilter("all");setNumber("all");setLinkOpen(false);
  setChannelHealth([]);setHealthError("");
  void loadThreads();void loadHealth();return()=>{threadGeneration.current++;chatGeneration.current++;searchGeneration.current++;};
 },[loadThreads,loadHealth]);

 function choose(id:string){
  if(selected===id)return;
  setSelected(id);selectedRef.current=id;setLinkOpen(false);setContactMatches([]);setSendReady(null);sendRequestId.current=null;
  setNotice("");void loadMessages(id);
  // Mark-read is per agent. Failing to acknowledge does not block history.
  void connectFetch(api+"/conversations/"+encodeURIComponent(id),{
   method:"PATCH",body:JSON.stringify({action:"mark_read",data:{}})
  }).then(()=>setThreads(prev=>prev.map(t=>t.id===id?{...t,unreadCount:0}:t))).catch(()=>{});
 }
 async function mutate(action:string,data:Record<string,unknown>,message:string){
  if(!selected||busy)return;
  const conversationId=selected;setBusy(true);setChatError("");setNotice("");
  try{
   await connectFetch(api+"/conversations/"+encodeURIComponent(conversationId),{
    method:"PATCH",body:JSON.stringify({action,data})
   });
   if(selectedRef.current!==conversationId)return;
   const r=await connectFetch<{ok:true;details:Details}>(api+"/conversations/"+encodeURIComponent(conversationId));
   if(selectedRef.current!==conversationId)return;
   setDetails(r.details);
   if(action==="save_draft")setDraft(r.details.draft);
   setNotice(message);
   if(action==="link_contact")setLinkOpen(false);
   if(action==="assign"||action==="set_status"||action==="link_contact")void loadThreads();
  }catch(e){if(selectedRef.current===conversationId)setChatError(e instanceof Error?e.message:"Could not save changes.");}
  finally{setBusy(false);}
 }
 async function sendTestReply(e:FormEvent){
  e.preventDefault();
  if(!selected||!canWrite||!details?.canWrite||!sendReady?.canSend||!draft.trim()||sending||busy)return;
  const conversation=selected;const content=draft.trim();
  const id=sendRequestId.current||crypto.randomUUID();sendRequestId.current=id;
  setSending(true);setChatError("");setNotice("");
  try{
   await connectFetch(api+"/conversations/"+encodeURIComponent(conversation)+"/send",{
    method:"POST",body:JSON.stringify({text:content,clientRequestId:id})
   });
   if(selectedRef.current!==conversation)return;
   setNotice("Meta accepted the test message. Delivery status will be updated by webhook.");
   sendRequestId.current=null;setDraft("");
   await connectFetch(api+"/conversations/"+encodeURIComponent(conversation),{
    method:"PATCH",body:JSON.stringify({action:"save_draft",data:{text:""}})
   });
   await Promise.all([loadMessages(conversation),loadThreads()]);
  }catch(e){
   if(selectedRef.current===conversation)setChatError(e instanceof Error?e.message:"Could not confirm test send.");
  }finally{setSending(false);}
 }
 async function searchContacts(e:FormEvent){
  e.preventDefault();const q=contactQuery.trim();if(q.length<2)return;
  const gen=++searchGeneration.current;setContactSearching(true);setContactMatches([]);setChatError("");
  try{
   const r=await connectFetch<{ok:true;items:ContactOption[]}>(api+"/contacts?q="+encodeURIComponent(q));
   if(gen===searchGeneration.current)setContactMatches(r.items);
  }catch(e){if(gen===searchGeneration.current)setChatError(e instanceof Error?e.message:"Contact search failed.");}
  finally{if(gen===searchGeneration.current)setContactSearching(false);}
 }
 const accounts=useMemo(()=>[...new Map(threads.map(t=>[t.channelId,{id:t.channelId,name:t.channelName}])).values()], [threads]);
 const visible=useMemo(()=>threads.filter(t=>{
  if(number!=="all"&&t.channelId!==number)return false;
  if(filter==="unread"&&t.unreadCount===0)return false;
  if(["open","pending","closed"].includes(filter)&&t.status!==filter)return false;
  const q=query.trim().toLowerCase();
  return !q||[t.personName,t.phone||"",t.channelName,t.lastMessage||""].some(x=>x.toLowerCase().includes(q));
 }),[threads,filter,number,query]);
 const chosen=threads.find(t=>t.id===selected);
 const canEdit=Boolean(canWrite&&details?.canWrite);
 const chronological=[...messages].reverse();
 return <section className="cx-wa-inbox" aria-label="WhatsApp CRM inbox">
  <div className="cx-wa-intro">
   <div><span className="cx-kicker">WHATSAPP WORKSPACE</span><h2>Messages & conversations</h2>
    <p>Organize WhatsApp threads across your connected business numbers.</p></div>
   <button className="cx-secondary" type="button" onClick={()=>{void loadThreads();void loadHealth();}} disabled={threadLoading||threadMore}>↻ Refresh</button>
  </div>
  <div className="cx-wa-safety" role="note">
   <strong>Business App coexistence — preparing integration</strong> · The priority is +91 85957 72008, currently used on the WhatsApp Business mobile app.
   No live number has been connected. The Meta test-send capability below remains restricted to configured test recipients;
   +91 92179 06540 (WA Simple) remains out of scope.
   <details className="cx-wa-readiness">
    <summary>Connection readiness &amp; safeguards</summary>
    <ul>
     <li>Ready in code: signed inbound-message webhook, mobile-app sent-message echoes and CRM conversation view.</li>
     <li>Pending: approved Meta Business App Coexistence onboarding and account authorization.</li>
     <li>Pending: historical chat and mobile-contact synchronization, plus live receive/reply/delivery tests.</li>
     <li>Do not register, transfer, disconnect or scan a QR code for either live number until onboarding is verified.</li>
    </ul>
    {healthError&&<p role="status">{healthError}</p>}
    {!healthError&&<div className="cx-wa-health-list">
     {channelHealth.length===0?<p>No WhatsApp channel registered for this workspace in DEV.</p>:
      channelHealth.map(h=><p key={h.channelId}><strong>{h.name}</strong> · {h.status} channel ·
       {" "+h.syncContacts} synced contacts · {h.historicalMessages} historical messages
       {h.lastMessageAt?" · Latest message "+shortDate(h.lastMessageAt):" · No messages yet"}
      </p>)}
    </div>}
   </details>
  </div>
  {error&&<div className="cx-alert" role="alert">{error}</div>}
  <div className={"cx-wa-layout "+(selected?"cx-wa-has-selection":"")}>
   <aside className="cx-wa-list" aria-label="WhatsApp conversations">
    <div className="cx-wa-list-controls">
     <label className="cx-wa-search"><span className="cx-sr-only">Search loaded chats</span>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search conversations…"/>
     </label>
     <div className="cx-wa-select-row">
      <label><span className="cx-sr-only">Conversation filter</span><select value={filter} onChange={e=>setFilter(e.target.value)}>
       <option value="all">All conversations</option><option value="unread">Unread</option>
       <option value="open">Open</option><option value="pending">Pending</option><option value="closed">Closed</option>
      </select></label>
      <label><span className="cx-sr-only">Business number</span><select value={number} onChange={e=>setNumber(e.target.value)}>
       <option value="all">All numbers</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>
     </div>
     <p className="cx-wa-list-count">{visible.length} loaded conversation{visible.length===1?"":"s"}</p>
    </div>
    <div className="cx-wa-thread-list">
     {threadLoading?<p className="cx-wa-empty">Loading conversations…</p>:visible.length===0?
      <div className="cx-wa-empty"><strong>No conversations found</strong><p>{threads.length?
       "Try another filter or search term.":"No WhatsApp channels or messages have been connected in DEV yet."}</p></div>:
      visible.map(t=><button key={t.id} type="button" onClick={()=>choose(t.id)}
       className={"cx-wa-thread "+(selected===t.id?"cx-wa-selected":"")}>
       <span className="cx-wa-avatar" aria-hidden="true">{initials(t.personName)}</span>
       <span className="cx-wa-thread-main">
        <span className="cx-wa-thread-top"><strong>{t.personName}</strong><time>{shortDate(t.lastAt)}</time></span>
        <span className="cx-wa-thread-preview">{t.lastDirection==="outbound"?"You: ":""}{t.lastMessage||labelType(t.lastType)}</span>
        <span className="cx-wa-thread-tags"><small>{t.channelName}</small><small>{t.status}</small></span>
       </span>
       {t.unreadCount>0&&<span className="cx-wa-unread" aria-label={t.unreadCount+" unread messages"}>{t.unreadCount>99?"99+":t.unreadCount}</span>}
      </button>)}
     {threadCursor&&<button type="button" className="cx-wa-load-more" disabled={threadMore} onClick={()=>void loadThreads(threadCursor,true)}>
      {threadMore?"Loading…":"Load older conversations"}</button>}
    </div>
    {query.trim()&&<p className="cx-wa-footnote">Search covers loaded conversations. Use “Load older” for more.</p>}
   </aside>
   <div className="cx-wa-chat" aria-label="Selected conversation">
    {!selected||!chosen?<div className="cx-wa-placeholder"><span aria-hidden="true">☏</span><h3>Select a conversation</h3>
     <p>Read message history, manage CRM contacts and prepare a reply.</p></div>:<>
     <header className="cx-wa-chat-header">
      <button className="cx-wa-back" type="button" onClick={()=>setSelected(null)} aria-label="Back to conversations">←</button>
      <span className="cx-wa-avatar" aria-hidden="true">{initials(chosen.personName)}</span>
      <div className="cx-wa-chat-identity"><strong>{chosen.personName}</strong>
       <small>{chosen.phone?"+"+chosen.phone.replace(/^\+/,""):"No phone recorded"} · {chosen.channelName}</small></div>
      <button type="button" className="cx-secondary" onClick={()=>void loadMessages(selected)} disabled={chatLoading}>Refresh</button>
      {chosen.personId&&onOpenContact&&<button className="cx-secondary" type="button" onClick={()=>onOpenContact(chosen.personId!)}>Contact 360°</button>}
     </header>
     <div className="cx-wa-tools">
      <label>Status <select value={details?.status||chosen.status} disabled={!canEdit||busy||!details}
       onChange={e=>void mutate("set_status",{status:e.target.value},"Conversation status updated.")}>
       <option value="open">Open</option><option value="pending">Pending</option><option value="closed">Closed</option></select></label>
      <label>Assigned to <select value={details?.assignedMemberId||""} disabled={!details?.canAssign||busy}
       onChange={e=>void mutate("assign",{memberId:e.target.value},"Conversation assignment updated.")}>
       <option value="">Unassigned</option>{details?.team.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <button type="button" className="cx-wa-link" disabled={!canEdit} onClick={()=>setLinkOpen(v=>!v)}>
       {linkOpen?"Cancel linking":"Link CRM contact"}</button>
     </div>
     {linkOpen&&canEdit&&<section className="cx-wa-link-panel" aria-label="Match CRM contact">
      <strong>Link to an existing CRM contact</strong>
      <p>Search by name or phone. This changes the thread's CRM link, not its WhatsApp recipient.</p>
      <form onSubmit={e=>void searchContacts(e)}>
       <input aria-label="Search contacts" value={contactQuery} onChange={e=>setContactQuery(e.target.value)}
        placeholder="Name or phone (at least 2 characters)" maxLength={100}/>
       <button className="cx-secondary" disabled={contactSearching||contactQuery.trim().length<2}>Search</button>
      </form>
      {contactSearching&&<p>Searching…</p>}
      {!contactSearching&&contactMatches.map(p=><button key={p.id} type="button" disabled={busy} className="cx-wa-contact-option"
       onClick={()=>void mutate("link_contact",{personId:p.id},"CRM contact linked.")}>
       <strong>{p.name}</strong><small>{p.phone||"No phone"}</small><span>Link</span>
      </button>)}
      {!contactSearching&&contactQuery.length>=2&&contactMatches.length===0&&<p className="cx-wa-footnote">Search to find an existing contact.</p>}
     </section>}
     {chatError&&<div className="cx-alert" role="alert">{chatError}</div>}
     {notice&&<p className="cx-wa-notice" role="status">{notice}</p>}
     <div className="cx-wa-messages" aria-live="polite">
      {messageCursor&&<button type="button" className="cx-wa-load-more" disabled={messageMore}
       onClick={()=>void loadMessages(selected,messageCursor,true)}>{messageMore?"Loading…":"Load older messages"}</button>}
      {chatLoading?<p className="cx-wa-empty">Loading messages…</p>:chronological.length===0?
       <p className="cx-wa-empty">No messages in this conversation.</p>:
       chronological.map(m=><article key={m.id} className={"cx-wa-bubble "+(m.direction==="outbound"?"cx-wa-outbound":"cx-wa-inbound")}>
        {m.replyTo&&<small className="cx-wa-reply-reference">Reply to {m.replyTo.slice(0,25)}…</small>}
        {m.kind!=="text"&&<span className="cx-wa-media-placeholder" aria-label={labelType(m.kind)+" message"}>▤ {labelType(m.kind)}
         {m.mediaFilename?" · "+m.mediaFilename:""}</span>}
        {m.body&&<p>{m.body}</p>}
        <footer><time>{clock(m.occurredAt)}</time>{m.direction==="outbound"&&
         <span title={m.failureReason||m.deliveryStatus}> · {m.deliveryStatus}</span>}</footer>
       </article>)}
     </div>
     <div className="cx-wa-composer">
      <form onSubmit={e=>void sendTestReply(e)}>
       <label htmlFor="cx-wa-compose">Reply via Meta test number</label>
       <textarea id="cx-wa-compose" rows={3} maxLength={3000} value={draft} disabled={!canEdit||busy}
        placeholder={canEdit?"Write a test reply…":"Your role has read-only access."}
        onChange={e=>{setDraft(e.target.value);sendRequestId.current=null;}}/>
       <div className="cx-wa-compose-actions">
        <small>{sendReady?.canSend?"Meta test recipient verified in configuration.":"Sending disabled: "+(sendReady?.reason||"Checking Meta test setup…")}</small>
        <button type="button" className="cx-secondary" onClick={()=>void mutate("save_draft",{text:draft},"Draft saved privately.")} disabled={!canEdit||busy||sending}>{busy?"Saving…":"Save draft"}</button>
        <button className="cx-primary" type="submit" disabled={!canEdit||!sendReady?.canSend||!draft.trim()||sending||busy}>{sending?"Sending…":"Send test reply"}</button>
       </div>
      </form>
     </div>
    </>}
   </div>
  </div>
 </section>;
}
