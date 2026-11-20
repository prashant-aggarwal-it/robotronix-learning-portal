"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Check={id:string;name:string;status:"healthy"|"degraded"|"down"|"unknown";latencyMs:number;detail:string};
type Health={observedAt:string;environment:string;overall:string;checks:Check[];scope:string;historicalMetrics:{uptimePercent:null;errorRatePercent:null;p95LatencyMs:null}};
export default function PlatformServiceHealth({compact=false}:{compact?:boolean}){
 const [health,setHealth]=useState<Health|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true;setBusy(true);
  (async()=>{
   const client=getSupabaseBrowserClient();
   const session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Verified sign-in required");
   const res=await fetch("/api/platform-admin/service-health",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const body=await res.json();
   if(!res.ok||!body.ok)throw Error(body.error||"Service health check failed");
   if(active){setHealth(body);setError("");}
  })().catch(e=>{if(active){setHealth(null);setError(e instanceof Error?e.message:"Service health unavailable");}}).finally(()=>{if(active)setBusy(false)});
  return()=>{active=false;};
 },[revision]);
 return <section className="platformPanel platformMonitorTile" aria-label="Live service health" aria-live="polite">
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h3>Services & APIs</h3><p>Measured on demand. Does not represent historical uptime.</p></div>
   <button type="button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>{busy?"Checking…":"Run checks"}</button>
  </div>
  {error&&<p role="alert">Health unknown: {error}</p>}
  {health&&<div>
   <p><strong>Current probe: {health.overall}</strong> · Checked {new Date(health.observedAt).toLocaleString()}</p>
   <div className="platformMonitorTiles">
    {health.checks.map(c=><div key={c.id} style={{border:"1px solid #ded6e8",borderRadius:10,padding:16}}>
     <strong>{c.name}</strong><p>Status: {c.status}</p><p>Request time: {c.latencyMs} ms</p><small>{c.detail}</small>
    </div>)}
   </div>
   {!compact&&<p>Uptime %, platform-wide error rate and historical p95 latency: not measured yet. These require persistent instrumentation and external availability checks.</p>}
  </div>}
  {!health&&!error&&busy&&<p role="status">Checking application and database…</p>}
 </section>;
}
