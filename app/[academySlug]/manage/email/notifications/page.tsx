"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
const EVENTS=[["enrollment","Enrollment"],["class_reminder","Class reminders"],["fee_reminder","Fee reminders"],["trainer_update","Trainer updates"],["progress_update","Progress updates"],["invitation","Invitations"]] as const;
type Job={id:string;event_type:string;recipient_email:string;provider:string|null;status:string;attempts:number;last_error_code:string|null;created_at:string};
export default function AcademyNotificationSettings(){
 const {academySlug}=useParams<{academySlug:string}>();
 const [organizationId,setOrganizationId]=useState(""),[enabled,setEnabled]=useState(false),[provider,setProvider]=useState(""),[events,setEvents]=useState<string[]>([]),[connections,setConnections]=useState<{provider:string;status:string}[]>([]),[jobs,setJobs]=useState<Job[]>([]),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 async function api(path:string,init?:RequestInit){
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
  const r=await fetch(path,{...init,headers:{"Authorization":"Bearer "+session.access_token,...init?.headers},cache:"no-store"});
  const b=await r.json();if(!r.ok)throw Error(b.error||"Request failed");return b;
 }
 useEffect(()=>{let active=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data:rows,error}=await client.rpc("saas_my_workspaces");if(error)throw error;
  const org=(Array.isArray(rows)?rows:[]).find((x:{id:string;slug:string;role:string;modules:string[]})=>x.slug===academySlug&&x.modules.includes("academy")&&["owner","admin"].includes(x.role));
  if(!org)throw Error("Academy owner or admin access required");
  const id=org.id;
  const [prefs,conn,history]=await Promise.all([api("/api/academy/email-notifications/preferences?organizationId="+id),api("/api/academy/email-connections?organizationId="+id),api("/api/academy/email-notifications/history?organizationId="+id)]);
  if(active){setOrganizationId(id);setEnabled(prefs.preferences.enabled);setProvider(prefs.preferences.provider||"");setEvents(prefs.preferences.enabled_events||[]);setConnections(conn.connections||[]);setJobs(history.jobs||[]);}
 }catch(e){if(active)setMessage(e instanceof Error?e.message:"Unable to load notifications");}finally{if(active)setBusy(false);}})();return()=>{active=false};},[academySlug]);
 async function retry(jobId:string){try{await api("/api/academy/email-notifications/retry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId,jobId})});setJobs(v=>v.map(j=>j.id===jobId?{...j,status:"queued",attempts:0}:j));setMessage("Retry queued");}catch(e){setMessage(e instanceof Error?e.message:"Retry failed");}}
 async function save(){setSaving(true);setMessage("");try{await api("/api/academy/email-notifications/preferences",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId,enabled,provider:provider||null,enabledEvents:events})});setMessage("Preferences saved");}catch(e){setMessage(e instanceof Error?e.message:"Save failed");}finally{setSaving(false);}}
 return <main style={{padding:"32px 20px",maxWidth:850,margin:"auto",fontFamily:"system-ui"}}>
  <Link href={"/"+academySlug+"/manage/email"}>← Email connections</Link>
  <h1>Academy email notifications</h1><p>Disabled by default. Select a connected academy email account before enabling messages.</p>
  {message&&<p role="status">{message}</p>}
  {busy?<p>Loading…</p>:<><section style={{display:"grid",gap:14,padding:20,border:"1px solid #dce3ef",borderRadius:12}}>
   <label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable automatic email notifications</label>
   <label>Email provider <select value={provider} onChange={e=>setProvider(e.target.value)}><option value="">Choose a connected provider</option>{connections.filter(c=>c.status==="connected").map(c=><option key={c.provider} value={c.provider}>{c.provider}</option>)}</select></label>
   <strong>Events</strong>
   {EVENTS.map(([key,title])=><label key={key}><input type="checkbox" checked={events.includes(key)} onChange={e=>setEvents(v=>e.target.checked?[...v,key]:v.filter(x=>x!==key))}/>{title}</label>)}
   <button disabled={saving||!organizationId||enabled&&!provider} onClick={save}>{saving?"Saving…":"Save preferences"}</button>
  </section>
  <h2>Recent delivery history</h2><p>Latest 100 jobs. No email message bodies are shown.</p>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th>Event</th><th>Recipient</th><th>Provider</th><th>Status</th><th>Attempts</th><th>Action</th></tr></thead><tbody>{jobs.map(j=><tr key={j.id}>{[j.event_type,j.recipient_email,j.provider||"—",j.status,j.attempts].map((v,i)=><td key={i} style={{padding:8,borderBottom:"1px solid #ddd"}}>{v}</td>)}<td>{j.status==="failed"?<button onClick={()=>retry(j.id)}>Retry</button>:null}</td></tr>)}</tbody></table></div>
  </>}
 </main>;
}
