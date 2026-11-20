"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Reliability={observedAt:string;database:{reachable:boolean;sizeBytes:number};backup:{status:string;lastVerifiedAt:null;restoreTestedAt:null;rpoMinutes:null;rtoMinutes:null};externalUptime:{status:string;uptimePercent:null};storage:{status:string};scope:string};
export default function PlatformReliability(){
 const [data,setData]=useState<Reliability|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setBusy(true);(async()=>{
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in first");
  const res=await fetch("/api/platform-admin/reliability",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await res.json();if(!res.ok||!body.ok)throw Error(body.error||"Reliability check unavailable");
  if(active){setData(body);setError("");}
 })().catch(e=>{if(active){setData(null);setError(e instanceof Error?e.message:"Reliability unavailable");}}).finally(()=>{if(active)setBusy(false)});
 return()=>{active=false};},[revision]);
 return <section className="platformPanel platformMonitorTile" aria-label="Data reliability and recovery readiness">
  <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
   <div><h3>Data & Reliability</h3><p>Observed database information and explicit recovery verification gaps.</p></div>
   <button type="button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>{busy?"Checking…":"Refresh checks"}</button>
  </div>
  {error&&<p role="alert">Reliability unknown: {error}</p>}
  {!data&&busy&&!error&&<p role="status">Checking data reliability…</p>}
  {data&&<>
   <p>Checked {new Date(data.observedAt).toLocaleString()}</p>
   <div className="platformMonitorTiles">
    <article className="platformMonitorTile" style={{border:"1px solid #e6dcf1",borderRadius:10,padding:16}}><h4>Database probe</h4><strong>{data.database.reachable?"Reachable":"Unknown"}</strong><p>Current database size: {(data.database.sizeBytes/1048576).toFixed(1)} MiB</p></article>
    <article className="platformMonitorTile" style={{border:"1px solid #e6dcf1",borderRadius:10,padding:16}}><h4>Backups</h4><strong>Not verified</strong><p>Backup configuration, last successful backup, RPO and RTO require provider evidence.</p></article>
    <article className="platformMonitorTile" style={{border:"1px solid #e6dcf1",borderRadius:10,padding:16}}><h4>Restore readiness</h4><strong>Not tested</strong><p>No evidence of a successful restore drill is recorded by this module.</p></article>
    <article className="platformMonitorTile" style={{border:"1px solid #e6dcf1",borderRadius:10,padding:16}}><h4>External uptime & storage</h4><strong>Not monitored</strong><p>Provider uptime and object storage growth need separate monitoring integrations.</p></article>
   </div>
   <p>{data.scope}</p>
  </>}
 </section>;
}
