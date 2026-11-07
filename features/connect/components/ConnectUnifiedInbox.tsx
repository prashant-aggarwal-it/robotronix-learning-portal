"use client";
import {useCallback,useEffect,useState} from "react";
import {connectFetch,crmList,type ConnectPerson} from "@/features/connect/api/client";
import {ConnectWhatsAppInbox} from "./ConnectWhatsAppInbox";
import styles from "./ConnectUnifiedInbox.module.css";

type Thread={id:string;provider:string;channelName:string;personId:string|null;personName:string|null;externalContactId:string|null;status:string;lastAt:string;lastMessage:string|null;lastDirection:string|null;unreadCount:number;classification:string};
type Message={id:string;body:string|null;kind:string;direction:string;occurredAt:string;deliveryStatus:string};
type Conversation={personId:string|null;provider:string;channelName:string;status:string;canWrite:boolean;classification:string;inquiryId:string|null;messages:Message[]};
type Attachment={messageId:string;id:string;filename:string;contentType:string;size:number};
const base=(tenantId:string)=>"/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/unified";
const stamp=(s:string)=>{const d=new Date(s);return Number.isNaN(d.getTime())?"":d.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});};
export function ConnectUnifiedInbox({tenantId,canWrite,onOpenContact}:{tenantId:string;canWrite:boolean;onOpenContact?:(id:string)=>void}){
 const [threads,setThreads]=useState<Thread[]>([]),[selected,setSelected]=useState<string|null>(null),[conversation,setConversation]=useState<Conversation|null>(null);
 const [attachments,setAttachments]=useState<Attachment[]>([]),[replyContext,setReplyContext]=useState<Record<string,unknown>|null>(null);
 const [filter,setFilter]=useState("all"),[view,setView]=useState("all"),[toolsOpen,setToolsOpen]=useState(false),[search,setSearch]=useState(""),[summary,setSummary]=useState(""),[personId,setPersonId]=useState(""),[replyText,setReplyText]=useState("");
 const [contacts,setContacts]=useState<ConnectPerson[]>([]),[nextCursor,setNextCursor]=useState<{at:string;id:string}|null>(null),[loadingMore,setLoadingMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const api=base(tenantId);
 const refresh=useCallback(async()=>{const r=await connectFetch<{items:Thread[];nextCursor:{at:string;id:string}|null}>(api+"/threads?limit=100");setThreads(r.items||[]);setNextCursor(r.nextCursor||null);},[api]);
 async function loadMore(){if(!nextCursor||loadingMore)return;setLoadingMore(true);setError("");
  try{const q=new URLSearchParams({limit:"100",beforeAt:nextCursor.at,beforeId:nextCursor.id});
   const r=await connectFetch<{items:Thread[];nextCursor:{at:string;id:string}|null}>(api+"/threads?"+q);
   setThreads(old=>{const seen=new Set(old.map(x=>x.id));return [...old,...r.items.filter(x=>!seen.has(x.id))];});
   setNextCursor(r.nextCursor||null);
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoadingMore(false);}
 }
 useEffect(()=>{setThreads([]);setSelected(null);setConversation(null);setError("");void refresh().catch(e=>setError(String(e)));},[refresh]);
 useEffect(()=>{if(!selected)return;let alive=true;setReplyText("");setToolsOpen(false);setConversation(null);setAttachments([]);setReplyContext(null);setNotice("");
  const path=api+"/conversations/"+encodeURIComponent(selected);
  void Promise.all([connectFetch<{conversation:Conversation}>(path),connectFetch<{attachments:Attachment[]}>(path+"/attachments")]).then(([a,b])=>{if(alive){setConversation(a.conversation);setAttachments(b.attachments||[]);}}).catch(e=>{if(alive)setError(String(e));});
  void connectFetch<{context:Record<string,unknown>}>(path+"/reply-context").then(r=>{if(alive)setReplyContext(r.context||null);}).catch(()=>{});
  void connectFetch(path,{method:"PATCH",body:JSON.stringify({action:"mark_read"})}).then(()=>{if(alive)setThreads(old=>old.map(t=>t.id===selected?{...t,unreadCount:0}:t));}).catch(()=>{});
  return()=>{alive=false;};
 },[api,selected]);
 async function openAttachment(messageId:string,attachmentId:string){
  if(!selected)return;setError("");
  try{
   const result=await connectFetch<{url:string}>(api+"/conversations/"+encodeURIComponent(selected)+"/attachment-link",{
    method:"POST",body:JSON.stringify({messageId,attachmentId})
   });
   const url=new URL(result.url);
   if(url.protocol!=="https:")throw new Error("Invalid download link.");
   window.open(url.toString(),"_blank","noopener,noreferrer");
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 }
 async function sendReply(){if(!selected||!replyText.trim()||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const path=api+"/conversations/"+encodeURIComponent(selected);
   await connectFetch(path+"/reply",{method:"POST",body:JSON.stringify({clientRequestId:crypto.randomUUID(),text:replyText.trim()})});
   setReplyText("");setNotice("Provider accepted the reply. Delivery may still be pending.");
   const r=await connectFetch<{conversation:Conversation}>(path);setConversation(r.conversation);await refresh();
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 }
 async function action(name:string,data:Record<string,unknown>={},id?:string){const target=id||selected;if(!target||busy)return;setBusy(true);setError("");setNotice("");
  try{await connectFetch(api+"/conversations/"+encodeURIComponent(target)+"/actions",{method:"PATCH",body:JSON.stringify(name==="link_contact"?{action:name,personId:data.personId}:{action:name,data})});
   const r=await connectFetch<{conversation:Conversation}>(api+"/conversations/"+encodeURIComponent(target));setConversation(r.conversation);await refresh();setNotice("Changes saved.");
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }

 const shown=threads.filter(t=>{
  if(filter!=="all"&&t.provider!==filter)return false;
  if(view==="unread"&&t.unreadCount===0)return false;
  if(view==="needs_reply"&&t.lastDirection!=="inbound")return false;
  if(view==="open"&&t.status!=="open")return false;
  if(view==="pending"&&t.status!=="pending")return false;
  if(view==="closed"&&t.status!=="closed")return false;
  const q=search.trim().toLowerCase();
  return !q||[t.personName,t.externalContactId,t.lastMessage,t.classification].some(x=>(x||"").toLowerCase().includes(q));
 });
 const current=threads.find(t=>t.id===selected);
 const unreadTotal=threads.reduce((n,t)=>n+t.unreadCount,0);
 const needsReply=threads.filter(t=>t.lastDirection==="inbound").length;
 const contactOptions=contacts.filter(c=>c.full_name.toLowerCase().includes(personId.toLowerCase())).slice(0,10);
 const providerLabel=(provider:string)=>provider==="whatsapp"?"WhatsApp":provider==="instagram"?"Instagram":provider==="facebook"?"Facebook":"Email";
 return <section className={styles.workspace} aria-label="Unified communications inbox">
  <header className={styles.head}>
   <div><h2>Inbox <span className={styles.count}>{threads.length}</span></h2>
    <p>Customer conversations across WhatsApp, Instagram, Facebook and email</p></div>
   <button className={styles.ghostButton} type="button" onClick={()=>void refresh().catch(e=>setError(String(e)))} aria-label="Refresh conversations">↻ Refresh</button>
  </header>
  {error&&<div className={styles.alert} role="alert">{error}</div>}
  {notice&&<div className={styles.notice} role="status">{notice}</div>}
  <div className={styles.channelTabs} role="group" aria-label="Filter by channel">
   {(["all","whatsapp","instagram","facebook","email"] as const).map(ch=><button type="button" key={ch} className={filter===ch?styles.channelActive:styles.channelButton} aria-pressed={filter===ch} onClick={()=>setFilter(ch)}>
    {ch==="all"?"All channels":providerLabel(ch)}
   </button>)}
  </div>
  <div className={styles.layout}>
   <aside className={styles.listPane} aria-label="Conversations">
    <div className={styles.listHeader}>
     <label className={styles.searchWrap}><span className={styles.srOnly}>Search conversations</span><input type="search" placeholder="Search conversations…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
     <div className={styles.filters}>
      <div className={styles.pillGroup} role="group" aria-label="Conversation status">
       <button type="button" className={view==="all"?styles.pillActive:styles.pill} aria-pressed={view==="all"} onClick={()=>setView("all")}>All</button>
       <button type="button" className={view==="unread"?styles.pillActive:styles.pill} aria-pressed={view==="unread"} onClick={()=>setView("unread")}>Unread {unreadTotal>0?"("+unreadTotal+")":""}</button>
       <button type="button" className={view==="needs_reply"?styles.pillActive:styles.pill} aria-pressed={view==="needs_reply"} onClick={()=>setView("needs_reply")}>Needs reply {needsReply>0?"("+needsReply+")":""}</button>
      </div>
      <label className={styles.srOnly} htmlFor="cx-thread-state">Conversation state</label>
      <select id="cx-thread-state" className={styles.stateSelect} aria-label="Conversation state" value={["all","unread","needs_reply"].includes(view)?"all":view} onChange={e=>setView(e.target.value)}>
       <option value="all">Any status</option><option value="open">Open</option><option value="pending">Pending</option><option value="closed">Closed</option>
      </select>
     </div>
     <p className={styles.resultCount}>{shown.length} conversation{shown.length===1?"":"s"} {search?"matching search":""}</p>
    </div>
    <div className={styles.threadList}>
     {shown.length===0?<div className={styles.empty}><strong>No conversations found</strong><p>{threads.length?"Try another filter or search term.":"Connected messages will appear here. Demo data is available in DEV."}</p></div>:
      shown.map(t=><button type="button" key={t.id} className={selected===t.id?styles.threadSelected:styles.thread} onClick={()=>setSelected(t.id)} aria-pressed={selected===t.id}>
       <span className={styles.avatar} aria-hidden="true">{(t.personName||"?").split(" ").filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")}</span>
       <span className={styles.threadContent}>
        <span className={styles.threadTop}><strong>{t.personName||t.externalContactId||"Unknown contact"}</strong><time>{stamp(t.lastAt)}</time></span>
        <span className={styles.preview}>{t.lastMessage||"No message preview"}</span>
        <span className={styles.threadMeta}><span className={styles.channelTag}>{providerLabel(t.provider)}</span><span>{t.classification==="unreviewed"?"Needs review":t.classification}</span>{t.status!=="open"&&<span>· {t.status}</span>}</span>
       </span>
       {t.unreadCount>0&&<span className={styles.unread} aria-label={t.unreadCount+" unread messages"}>{t.unreadCount>99?"99+":t.unreadCount}</span>}
      </button>)}
     {nextCursor&&<button type="button" className={styles.more} disabled={loadingMore} onClick={()=>void loadMore()}>{loadingMore?"Loading…":"Load older conversations"}</button>}
    </div>
   </aside>
   <div className={styles.chatPane} aria-label="Conversation details">
    {!selected?<div className={styles.placeholder}><span className={styles.placeholderIcon} aria-hidden="true">✉</span><h3>Select a conversation</h3><p>Choose a customer on the left to read their messages and manage the enquiry.</p></div>:
     !conversation?<div className={styles.placeholder}><p>Loading conversation…</p></div>:<>
      <header className={styles.chatHead}>
       <div className={styles.chatIdentity}>
        <span className={styles.avatar} aria-hidden="true">{(current?.personName||"?").split(" ").filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")}</span>
        <div><h3>{current?.personName||current?.externalContactId||"Conversation"}</h3><p>{providerLabel(conversation.provider)} · {conversation.status} · {conversation.classification}</p></div>
       </div>
       {conversation.personId&&onOpenContact&&<button className={styles.ghostButton} type="button" onClick={()=>onOpenContact(conversation.personId!)}>View contact</button>}
      </header>
      <div className={styles.messages} aria-live="polite">
       {(conversation.messages||[]).length===0&&<p className={styles.empty}>No messages in this conversation yet.</p>}
       {(conversation.messages||[]).map(m=><article key={m.id} className={m.direction==="outbound"?styles.messageOut:styles.messageIn}>
        <div className={styles.bubble}><p>{m.body||"["+m.kind+"]"}</p>
         {attachments.filter(a=>a.messageId===m.id).map(a=><div className={styles.attachment} key={a.id}>📎 {a.filename||"Attachment"} {conversation.provider==="email"&&<button type="button" onClick={()=>void openAttachment(m.id,a.id)}>Open</button>}</div>)}
         <small>{stamp(m.occurredAt)}{m.direction==="outbound"?" · "+m.deliveryStatus:""}</small>
        </div>
       </article>)}
      </div>
      <div className={styles.chatFooter}>
       {conversation.provider!=="whatsapp"&&<div className={styles.reply}>
        {replyContext?.canReply===true&&canWrite?<><label htmlFor="cx-compose-reply">Reply to customer</label><textarea id="cx-compose-reply" rows={2} maxLength={conversation.provider==="email"?12000:1000} placeholder="Write a reply…" value={replyText} onChange={e=>setReplyText(e.target.value)}/>
         <div className={styles.replyActions}><small>Sending requires configured and enabled provider credentials.</small><button className={styles.primary} type="button" disabled={busy||!replyText.trim()} onClick={()=>void sendReply()}>Send reply</button></div></>:
         <p className={styles.muted}>Replies are unavailable until the channel is active and within its permitted messaging window.</p>}
       </div>}
       {conversation.provider==="whatsapp"&&<div className={styles.whatsappNote}><span>WhatsApp sending and administration are currently restricted to the existing tested workflow.</span>
        <button className={styles.ghostButton} type="button" onClick={()=>setToolsOpen(v=>!v)} aria-expanded={toolsOpen}>{toolsOpen?"Hide WhatsApp tools":"WhatsApp tools"}</button></div>}
       {canWrite&&conversation.canWrite&&<details className={styles.detailBox}>
        <summary>Enquiry &amp; contact actions <span className={styles.muted}>· {conversation.classification}</span></summary>
        <div className={styles.detailContents}>
         {conversation.classification!=="enquiry"&&<><label htmlFor="cx-enquiry-summary">Enquiry summary</label><textarea id="cx-enquiry-summary" rows={2} maxLength={2000} placeholder="Describe the customer's enquiry" value={summary} onChange={e=>setSummary(e.target.value)}/><div className={styles.actionRow}><button className={styles.primary} type="button" disabled={busy||!summary.trim()} onClick={()=>void action("mark_enquiry",{summary})}>Mark as enquiry</button><button className={styles.ghostButton} type="button" disabled={busy} onClick={()=>void action("not_enquiry")}>Not an enquiry</button></div></>}
         {conversation.inquiryId&&<small>Linked enquiry: {conversation.inquiryId}</small>}
         <div className={styles.actionRow}><button className={styles.ghostButton} type="button" disabled={busy} onClick={()=>void crmList<ConnectPerson>(tenantId,"people",{limit:"100"}).then(r=>setContacts(r.items)).catch(e=>setError(String(e)))}>Find CRM contact</button>
          {conversation.personId&&onOpenContact&&<button type="button" className={styles.ghostButton} onClick={()=>onOpenContact(conversation.personId!)}>Open linked contact</button>}</div>
         {contacts.length>0&&<><input aria-label="Filter CRM contacts" placeholder="Filter contacts by name" value={personId} onChange={e=>setPersonId(e.target.value)}/><select aria-label="Link contact" value="" onChange={e=>{if(e.target.value)void action("link_contact",{personId:e.target.value});}}><option value="">Select a contact to link</option>{contactOptions.map(c=><option value={c.id} key={c.id}>{c.full_name}</option>)}</select></>}
        </div>
       </details>}
      </div>
      {conversation.provider==="whatsapp"&&toolsOpen&&<div className={styles.advancedTools}><p className={styles.muted}>Advanced WhatsApp tools include test replies, assignment, draft management and connection diagnostics. Only configured WhatsApp channels are available here.</p>
       <ConnectWhatsAppInbox tenantId={tenantId} canWrite={canWrite} onOpenContact={onOpenContact}/></div>}
     </>}
   </div>
  </div>
 </section>;
}
