"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import PlatformEmailHealth from "./PlatformEmailHealth";
import PlatformServiceHealth from "./PlatformServiceHealth";
import PlatformWorkerHealth from "./PlatformWorkerHealth";
import PlatformCustomerHealth from "./PlatformCustomerHealth";
import PlatformIncidents from "./PlatformIncidents";
import PlatformReliability from "./PlatformReliability";

type Panel="overview"|"services"|"email"|"security"|"recovery";
const tabs:{id:Panel;label:string}[]=[{id:"overview",label:"Overview"},{id:"services",label:"Services & Jobs"},{id:"email",label:"Email & Integrations"},{id:"security",label:"Security & Incidents"},{id:"recovery",label:"Data & Recovery"}];
type Check={status:string;detail:string;checkedAt?:string;target:Panel};
type HealthChecks=Record<"services"|"jobs"|"email"|"incidents"|"database"|"backups",Check>;
const blank:HealthChecks={
 services:{status:"Unknown",detail:"Not checked",target:"services"},
 jobs:{status:"Unknown",detail:"Worker execution not checked",target:"services"},
 email:{status:"Unknown",detail:"Email activity not checked",target:"email"},
 incidents:{status:"Unknown",detail:"Incident records not checked",target:"security"},
 database:{status:"Unknown",detail:"Database not checked",target:"recovery"},
 backups:{status:"Unverified",detail:"Restore readiness requires independent evidence",target:"recovery"}
};
export default function PlatformSystemHealth(){
 const [panel,setPanel]=useState<Panel>("overview");
 const [checks,setChecks]=useState<HealthChecks>(blank);
 const [loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{if(panel!=="overview")return;let active=true;setLoading(true);(async()=>{
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in required");
  const urls={services:"service-health",jobs:"worker-health",email:"email-health",incidents:"incidents",recovery:"reliability"};
  const results=await Promise.all(Object.entries(urls).map(async([key,path])=>{
   try{const res=await fetch("/api/platform-admin/"+path,{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
    const body=await res.json();if(!res.ok||!body.ok)throw Error("Check unavailable");
    return [key,body] as const;
   }catch{return [key,null] as const;}
  }));
  if(!active)return;
  const map=Object.fromEntries(results) as Record<string,any>;
  const date=(d:any)=>typeof d==="string"?d:undefined;
  setChecks({
   services:map.services?{status:map.services.overall==="healthy"?"Healthy":map.services.overall||"Unknown",detail:"On-demand API and database probes; not historical uptime",checkedAt:date(map.services.observedAt),target:"services"}:blank.services,
   jobs:map.jobs?{status:map.jobs.status||"Unknown",detail:map.jobs.scheduledExecutionVerified?"Scheduler execution verified":"Scheduled execution not verified",checkedAt:date(map.jobs.observedAt),target:"services"}:blank.jobs,
   email:map.email?{status:((map.email.jobs?.queued??0)+(map.email.jobs?.sending??0)+(map.email.jobs?.sent??0)+(map.email.jobs?.failed??0))===0?"No recent jobs":"Activity recorded",detail:"Queued: "+(map.email.jobs?.queued??0)+" · Failed: "+(map.email.jobs?.failed??0)+" · No activity does not mean healthy delivery",target:"email"}:blank.email,
   incidents:map.incidents?{status:"Records available",detail:"Open incidents: "+(map.incidents.incidents||[]).filter((i:any)=>i.status!=="resolved").length+" · On-demand detection only",target:"security"}:blank.incidents,
   database:map.recovery?{status:map.recovery.database?.reachable?"Reachable":"Unknown",detail:"Connectivity observed; not a recovery guarantee",checkedAt:date(map.recovery.observedAt),target:"recovery"}:blank.database,
   backups:map.recovery?{status:"Unverified",detail:"Restore drill and backup evidence not recorded",target:"recovery"}:blank.backups
  });
 })().catch(()=>{if(active)setChecks(blank)}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false};},[panel,refresh]);
 return <section className="platformSystemHealth" aria-label="System health and monitoring">
  <div className="platformSectionIntro"><div><span className="platformEyebrow">PLATFORM OPERATIONS</span><h2>System Health & Monitoring</h2><p>Operational checks and unresolved verification gaps. Unknown is not healthy.</p></div></div>
  <nav className="platformMonitorTabs" aria-label="Monitoring sections">
   {tabs.map(t=><button type="button" key={t.id} className={panel===t.id?"platformMonitorTab active":"platformMonitorTab"} aria-current={panel===t.id?"page":undefined} onClick={()=>setPanel(t.id)}>{t.label}</button>)}
  </nav>
  {panel==="overview"&&<section className="platformPanel platformMonitorTile">
   <div className="platformHealthHeading"><div><h3>Operational overview</h3><p>Latest observations, not continuous monitoring or proof of uptime.</p></div><button type="button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>{loading?"Checking…":"Refresh checks"}</button></div>
   <div className="platformHealthGrid">{Object.entries(checks).map(([key,c])=><button type="button" className="platformHealthSummaryItem" key={key} onClick={()=>setPanel(c.target)}>
    <span className="platformHealthLabel">{({services:"Services & APIs",jobs:"Background worker",email:"Email delivery",incidents:"Incidents",database:"Database",backups:"Backup & recovery"} as Record<string,string>)[key]}</span>
    <strong className={c.status.toLowerCase()==="healthy"||c.status.toLowerCase()==="reachable"?"platformHealthSuccess":"platformHealthUnknown"}>{c.status}</strong>
    <span>{c.detail}</span>{c.checkedAt&&<small>Checked {new Date(c.checkedAt).toLocaleString()}</small>}
   </button>)}</div>
   <p className="platformHealthNote">Attention: confirm scheduled worker execution, real email delivery, and an independently verified backup/restore drill before production sign-off. Incident scans must currently be started manually.</p>
  </section>}
  {panel==="services"&&<div className="platformHealthStack"><PlatformServiceHealth/><PlatformWorkerHealth/></div>}
  {panel==="email"&&<div className="platformHealthStack"><PlatformEmailHealth/><PlatformCustomerHealth compact/></div>}
  {panel==="security"&&<div className="platformHealthStack"><PlatformIncidents/><section className="platformPanel platformMonitorTile"><h3>Privileged administrator access</h3><p>Manage verified administrator accounts and review access changes in Platform Settings → Security &amp; Admins.</p><a href="/platform-admin#security">Open administrator security</a></section></div>}
  {panel==="recovery"&&<PlatformReliability/>}
 </section>;
}
