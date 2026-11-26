"use client";
import {formatPlatformLabel} from "./formatPlatformLabel";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Counts=Record<string,number>;
type Health={observedAt:string;customers:Counts;subscriptions:Counts;invitations:Counts;deliveries:Counts;emailConnections:Counts;integrationCoverage:Record<string,string>};
export default function PlatformCustomerHealth({compact=false}:{compact?:boolean}){
 const [data,setData]=useState<Health|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setBusy(true);(async()=>{
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in first");
  const response=await fetch("/api/platform-admin/customer-health",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Customer health unavailable");
  if(active){setData(body);setError("");}
 })().catch(e=>{if(active){setError(e instanceof Error?e.message:"Customer health unavailable");setData(null);}}).finally(()=>{if(active)setBusy(false);});
 return()=>{active=false};},[revision]);
 return <section className="platformPanel platformMonitorTile" aria-label="Customer subscriptions and integrations health">
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h3>Customer, Subscription & Integration Health</h3><p>Platform-wide aggregate counts; no customer secrets or message contents.</p></div>
   <button type="button" disabled={busy} onClick={()=>setRevision(x=>x+1)}>{busy?"Refreshing…":"Refresh"}</button>
  </div>
  {error&&<p role="alert">Health unknown: {error}</p>}
  {busy&&!data&&!error&&<p role="status">Loading health summary…</p>}
  {data&&<>
   <p>Observed {new Date(data.observedAt).toLocaleString()}</p>
   {!compact&&<div className="platformMonitorTiles">
    {([{label:"Total academies",value:data.customers.total},{label:"Active academies",value:data.customers.active},{label:"Suspended academies",value:data.customers.suspended},{label:"Awaiting activation",value:data.invitations.pending},{label:"Expired invitations",value:data.invitations.expired},{label:"Expiring trials (7 days)",value:data.subscriptions.expiringTrials},{label:"Expired trials",value:data.subscriptions.expiredTrials},{label:"Past-due subscriptions",value:data.subscriptions.pastDue},{label:"Invitation delivery failures",value:data.deliveries.failed},{label:"Connected email accounts",value:data.emailConnections.connected},{label:"Email accounts needing attention",value:data.emailConnections.attention}]).map(x=><article key={x.label} style={{padding:14,border:"1px solid #e4ddeb",borderRadius:10}}><strong style={{fontSize:22}}>{x.value}</strong><p style={{margin:0}}>{x.label}</p></article>)}
   </div>}
   {compact&&<p>Customer trials, activation and subscription status are managed from the main Control Centre Overview and Subscriptions screens.</p>}
   <h3>Integration coverage</h3>
   <p>These are monitoring-coverage states, not provider uptime checks.</p>
   <div className="platformMonitorTiles">{Object.entries(data.integrationCoverage).map(([provider,coverage])=><div key={provider} style={{padding:14,border:"1px solid #e4ddeb",borderRadius:10}}><strong>{formatPlatformLabel(provider)}</strong><p>{coverage==="not_instrumented"?"Not monitored":coverage==="connection_records_only"?"Connection records only — provider not live-tested":formatPlatformLabel(coverage)}</p></div>)}</div>
   <p>Manage individual customers in the Directory and Subscriptions screens. Live Zoom, Razorpay and OAuth token refresh testing are not included in Phase 9D.</p>
  </>}
 </section>;
}
