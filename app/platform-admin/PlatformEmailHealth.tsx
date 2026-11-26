"use client";
import {formatPlatformLabel} from "./formatPlatformLabel";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type Health={windowDays:number;jobs:Record<string,number>;connections:{connected:number;attention:number};connectionsTruncated:boolean};
export default function PlatformEmailHealth(){
 const [data,setData]=useState<Health|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  (async()=>{
   const client=getSupabaseBrowserClient();
   const session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in to view platform email health");
   const res=await fetch("/api/platform-admin/email-health",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const body=await res.json();
   if(!res.ok||!body.ok)throw Error(body.error||"Email health unavailable");
   if(active)setData(body);
  })().catch(e=>{if(active){setData(null);setError(e instanceof Error?e.message:"Email health unavailable")}}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[revision]);
 return <section className="platformPanel" aria-label="Academy email health" style={{padding:20,marginBottom:20}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
   <div><h2>Academy email health</h2><p>Platform-wide operational counts for the past 7 days. Message contents and credentials are never shown.</p></div>
   <button type="button" onClick={()=>setRevision(v=>v+1)} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button>
  </div>
  {error&&<p role="alert">{error}</p>}
  {data&&<><div className="platformHealthStats">
   {(["queued","sending","sent","failed"] as const).map(status=><div key={status}><strong style={{fontSize:22,display:"block"}}>{data.jobs[status]||0}</strong><span>{status==="sent"?"Provider Accepted":formatPlatformLabel(status)}</span></div>)}
   <div><strong style={{fontSize:22,display:"block"}}>{data.connections.attention}</strong><span>Connections needing attention</span></div>
  </div><p>Connected accounts: {data.connections.connected}. “Provider accepted” does not guarantee inbox delivery.</p>
  {data.connectionsTruncated&&<p role="status">Connection totals are partial due to a bounded result limit.</p>}</>}
 </section>;
}
