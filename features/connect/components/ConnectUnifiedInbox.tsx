"use client";
import {useCallback,useEffect,useState} from "react";
import {connectFetch,crmList,type ConnectPerson} from "@/features/connect/api/client";

type Thread={id:string;provider:string;channelName:string;personId:string|null;personName:string|null;externalContactId:string|null;status:string;lastAt:string;lastMessage:string|null;unreadCount:number;classification:string};
type Message={id:string;body:string|null;kind:string;direction:string;occurredAt:string;deliveryStatus:string};
type Conversation={personId:string|null;provider:string;channelName:string;status:string;canWrite:boolean;classification:string;inquiryId:string|null;messages:Message[]};
type Attachment={messageId:string;id:string;filename:string;contentType:string;size:number};
const base=(tenantId:string)=>"/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/unified";
const stamp=(s:string)=>{const d=new Date(s);return Number.isNaN(d.getTime())?"":d.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});};
export function ConnectUnifiedInbox({tenantId,canWrite,onOpenContact}:{tenantId:string;canWrite:boolean;onOpenContact?:(id:string)=>void}){
 const [threads,setThreads]=useState<Thread[]>([]),[selected,setSelected]=useState<string|null>(null),[conversation,setConversation]=useState<Conversation|null>(null);
 const [attachments,setAttachments]=useState<Attachment[]>([]),[replyContext,setReplyContext]=useState<Record<string,unknown>|null>(null);
 const [filter,setFilter]=useState("all"),[search,setSearch]=useState(""),[summary,setSummary]=useState(""),[personId,setPersonId]=useState("");
 const [contacts,setContacts]=useState<ConnectPerson[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const api=base(tenantId);
 const refresh=useCallback(async()=>{const r=await connectFetch<{items:Thread[]}>(api+"/threads?limit=100");setThreads(r.items||[]);},[api]);
 useEffect(()=>{setThreads([]);setSelected(null);setConversation(null);setError("");void refresh().catch(e=>setError(String(e)));},[refresh]);
 useEffect(()=>{if(!selected)return;let alive=true;setConversation(null);setAttachments([]);setReplyContext(null);setNotice("");
  const path=api+"/conversations/"+encodeURIComponent(selected);
  void Promise.all([connectFetch<{conversation:Conversation}>(path),connectFetch<{attachments:Attachment[]}>(path+"/attachments")]).then(([a,b])=>{if(alive){setConversation(a.conversation);setAttachments(b.attachments||[]);}}).catch(e=>{if(alive)setError(String(e));});
  void connectFetch<{context:Record<string,unknown>}>(path+"/reply-context").then(r=>{if(alive)setReplyContext(r.context||null);}).catch(()=>{});
  void connectFetch(path,{method:"PATCH",body:JSON.stringify({action:"mark_read"})}).then(()=>{if(alive)setThreads(old=>old.map(t=>t.id===selected?{...t,unreadCount:0}:t));}).catch(()=>{});
  return()=>{alive=false;};
 },[api,selected]);
 async function action(name:string,data:Record<string,unknown>={},id?:string){const target=id||selected;if(!target||busy)return;setBusy(true);setError("");setNotice("");
  try{await connectFetch(api+"/conversations/"+encodeURIComponent(target)+"/actions",{method:"PATCH",body:JSON.stringify(name==="link_contact"?{action:name,personId:data.personId}:{action:name,data})});
   const r=await connectFetch<{conversation:Conversation}>(api+"/conversations/"+encodeURIComponent(target));setConversation(r.conversation);await refresh();setNotice("Changes saved.");
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 const shown=threads.filter(t=>(filter==="all"||t.provider===filter)&&[t.personName,t.externalContactId,t.lastMessage].some(x=>(x||"").toLowerCase().includes(search.toLowerCase())));
 const contactOptions=contacts.filter(c=>c.full_name.toLowerCase().includes(personId.toLowerCase())).slice(0,10);
 return <div className="cx-panel cx-panel-full" style={{padding:16}}>
  <div className="cx-panel-header"><div><h2>Unified inbox</h2><p>WhatsApp, Instagram, Facebook and email in one view</p></div><button type="button" onClick={()=>void refresh().catch(e=>setError(String(e)))}>Refresh</button></div>
  {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}><select aria-label="Channel filter" value={filter} onChange={e=>setFilter(e.target.value)}>{["all","whatsapp","instagram","facebook","email"].map(x=><option key={x} value={x}>{x==="all"?"All channels":x}</option>)}</select><input aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <div style={{display:"grid",gridTemplateColumns:"minmax(210px,1fr) minmax(0,2fr)",gap:16}}>
   <div style={{maxHeight:640,overflowY:"auto"}}>{shown.length===0?<p>No conversations found.</p>:shown.map(t=><button type="button" key={t.id} onClick={()=>setSelected(t.id)} style={{display:"block",width:"100%",textAlign:"left",padding:12,marginBottom:6,border:"1px solid #d8e3ec",borderRadius:10,background:selected===t.id?"#eaf5fc":"transparent",color:"inherit"}}>
    <strong>{t.personName||t.externalContactId||"Unknown contact"}</strong> {t.unreadCount>0&&<span>({t.unreadCount} new)</span>}<div><small>{t.provider} · {stamp(t.lastAt)} · {t.classification}</small></div><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.lastMessage||"No preview"}</div>
   </button>)}</div>
   <div style={{minWidth:0}}>{!selected?<p>Select a conversation to view its history.</p>:!conversation?<p>Loading conversation…</p>:<>
    <h3>{threads.find(t=>t.id===selected)?.personName||"Conversation"} <small>({conversation.provider})</small></h3>
    <div style={{maxHeight:380,overflowY:"auto",padding:12,border:"1px solid #d8e3ec",borderRadius:10}}>
     {(conversation.messages||[]).map(m=><div key={m.id} style={{marginBottom:10,textAlign:m.direction==="outbound"?"right":"left"}}><div style={{display:"inline-block",maxWidth:"90%",padding:10,borderRadius:10,background:m.direction==="outbound"?"#e2f4ed":"#eef4f8",textAlign:"left",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{m.body||"["+m.kind+"]"}<div><small>{stamp(m.occurredAt)} · {m.deliveryStatus}</small></div>
      {attachments.filter(a=>a.messageId===m.id).map(a=><div key={a.id}><small>Attachment: {a.filename} ({a.contentType})</small></div>)}</div></div>)}
     {!conversation.messages?.length&&<p>No messages yet.</p>}
    </div>
    {canWrite&&conversation.canWrite&&<div style={{display:"grid",gap:8,marginTop:12}}>
     <strong>Enquiry classification: {conversation.classification}</strong>
     {conversation.classification!=="enquiry"&&<><textarea aria-label="Enquiry summary" rows={2} maxLength={2000} placeholder="Describe the enquiry before saving" value={summary} onChange={e=>setSummary(e.target.value)}/><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy||!summary.trim()} onClick={()=>void action("mark_enquiry",{summary})}>Mark as enquiry</button><button disabled={busy} onClick={()=>void action("not_enquiry")}>Not an enquiry</button></div></>}
     {conversation.inquiryId&&<small>Linked enquiry: {conversation.inquiryId}</small>}
     <div><button disabled={busy} onClick={()=>{void crmList<ConnectPerson>(tenantId,"people",{limit:"100"}).then(r=>setContacts(r.items)).catch(e=>setError(String(e)));}}>Find CRM contact</button>
      {contacts.length>0&&<><input aria-label="Filter CRM contacts" placeholder="Filter by name" value={personId} onChange={e=>setPersonId(e.target.value)}/><select aria-label="Link contact" defaultValue="" onChange={e=>{if(e.target.value)void action("link_contact",{personId:e.target.value});}}><option value="">Select a contact to link</option>{contactOptions.map(c=><option value={c.id} key={c.id}>{c.full_name}</option>)}</select></>}
      {conversation.personId&&onOpenContact&&<button onClick={()=>onOpenContact(conversation.personId!)}>Open linked contact</button>}
     </div>
    </div>}
    {conversation.provider!=="whatsapp"&&<p style={{marginTop:12}}><small>{replyContext?.canReply===true?"Reply eligibility confirmed. Sending remains disabled until provider credentials and delivery integration are validated.":"Replies are unavailable or outside the permitted messaging window."}</small></p>}
    {conversation.provider==="whatsapp"&&<p><small>For WhatsApp replies, use the existing WhatsApp inbox while Meta sending is being validated.</small></p>}
   </>}</div>
  </div>
 </div>;
}
