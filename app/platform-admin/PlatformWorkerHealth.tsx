"use client";
import {formatPlatformLabel} from "./formatPlatformLabel";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Data={status:string;observedAt:string;heartbeat:{last_started_at:string|null;last_completed_at:string|null;last_failed_at:string|null;last_status:string;last_discovered:number|null;last_processed:number|null;last_error_code:string|null}|null;queue:{queued:number;retry:number;failed:number;sending:number;retried:number;due:number;staleSending:number;oldestWaitMinutes:number|null};note:string;scheduledExecutionVerified:boolean};
export default function PlatformWorkerHealth(){
 const [data,setData]=useState<Data|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true;
  setBusy(true);
  (async()=>{
   const client=getSupabaseBrowserClient();
   const session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const res=await fetch("/api/platform-admin/worker-health",{cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}});
   const body=await res.json();
   if(!res.ok||!body.ok)throw Error(body.error||"Unable to load worker health");
   if(active){setData(body);setError("");}
  })().catch(e=>{if(active){setError(e instanceof Error?e.message:"Worker health unavailable");setData(null);}}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[revision]);
 return <section className="platformPanel platformMonitorTile" aria-label="Background job health">
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h3>Background Jobs</h3><p>Email notification worker and queue statistics</p></div>
   <button type="button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>{busy?"Refreshing…":"Refresh"}</button>
  </div>
  {error&&<p role="alert">Worker status unknown: {error}</p>}
  {busy&&!data&&!error&&<p role="status">Checking worker and queue…</p>}
  {data&&<>
   <p role="status"><strong>Worker status: {formatPlatformLabel(data.status)}</strong> · Last checked {new Date(data.observedAt).toLocaleString()}</p>
   <div className="platformHealthStats">
    {([{label:"Queued",value:data.queue.queued},{label:"Retrying",value:data.queue.retry},{label:"Failed",value:data.queue.failed},{label:"Sending",value:data.queue.sending},{label:"Due now",value:data.queue.due},{label:"Retried jobs",value:data.queue.retried},{label:"Stale sending",value:data.queue.staleSending},{label:"Oldest waiting (min)",value:data.queue.oldestWaitMinutes??"—"}]).map(x=><div key={x.label} className="platformHealthStat"><strong style={{fontSize:20}}>{x.value}</strong><p style={{margin:0}}>{x.label}</p></div>)}
   </div>
   <h3>Notification worker heartbeat</h3>
   {data.heartbeat?<dl>
    <dt>Last run started</dt><dd>{data.heartbeat.last_started_at?new Date(data.heartbeat.last_started_at).toLocaleString():"Not recorded"}</dd>
    <dt>Last completed</dt><dd>{data.heartbeat.last_completed_at?new Date(data.heartbeat.last_completed_at).toLocaleString():"Not recorded"}</dd>
    <dt>Last result</dt><dd>{formatPlatformLabel(data.heartbeat.last_status)}</dd>
    <dt>Events discovered / jobs processed (last success)</dt><dd>{data.heartbeat.last_discovered??"—"} / {data.heartbeat.last_processed??"—"}</dd>
   </dl>:<p>No heartbeat recorded yet. Scheduled execution has not been verified.</p>}
   <p>{data.note}</p>
   <p>Scheduled execution verified: <strong>{data.scheduledExecutionVerified?"Yes":"No"}</strong>. A heartbeat does not prove email delivery.</p>
  </>}
 </section>;
}
