"use client";
import {useState} from "react";
import PlatformEmailHealth from "./PlatformEmailHealth";
import PlatformAdminSafety from "./PlatformAdminSafety";
import PlatformServiceHealth from "./PlatformServiceHealth";
import PlatformWorkerHealth from "./PlatformWorkerHealth";

type Panel="summary"|"email"|"security"|"services"|"jobs";
const sections:{id:Panel;label:string}[]=[
 {id:"summary",label:"Summary"},
 {id:"email",label:"Email monitoring"},
 {id:"security",label:"Security & audit"},
 {id:"services",label:"Services & APIs"},
 {id:"jobs",label:"Background jobs"}
];

/** Phase 9A organizes existing operational views. It does not invent health measurements. */
export default function PlatformSystemHealth(){
 const [panel,setPanel]=useState<Panel>("summary");
 return <section className="platformSystemHealth" aria-label="System health and monitoring">
  <div className="platformSectionIntro">
   <div><span className="platformEyebrow">PLATFORM OPERATIONS</span><h2>System Health & Monitoring</h2>
   <p>Operational visibility for platform administrators. Only observed results are treated as evidence of health.</p></div>
  </div>
  <nav className="platformMonitorTabs" aria-label="Monitoring sections">
   {sections.map(s=><button type="button" key={s.id} className={panel===s.id?"platformMonitorTab active":"platformMonitorTab"}
    aria-current={panel===s.id?"page":undefined} onClick={()=>setPanel(s.id)}>{s.label}</button>)}
  </nav>
  {panel==="summary"&&<div className="platformMonitorTiles">
   <article className="platformPanel platformMonitorTile"><h3>Application & APIs</h3><strong>On-demand health checks</strong><p>Measure application and database response time; historical uptime is not yet recorded.</p><button type="button" onClick={()=>setPanel("services")}>Service coverage</button></article>
   <article className="platformPanel platformMonitorTile"><h3>Email delivery</h3><strong>Available in Email monitoring</strong><p>View recorded queue, provider-acceptance and failure counts.</p><button type="button" onClick={()=>setPanel("email")}>View email monitoring</button></article>
   <article className="platformPanel platformMonitorTile"><h3>Jobs & workers</h3><strong>Heartbeat and queue tracking</strong><p>Review worker executions, queue delays, retries and failures.</p><button type="button" onClick={()=>setPanel("jobs")}>Job coverage</button></article>
   <article className="platformPanel platformMonitorTile"><h3>Administrator audit</h3><strong>Existing records available</strong><p>Inspect privileged administrator changes and verified access.</p><button type="button" onClick={()=>setPanel("security")}>View audit</button></article>
  </div>}
  {panel==="email"&&<PlatformEmailHealth/>}
  {panel==="security"&&<PlatformAdminSafety/>}
  {panel==="services"&&<PlatformServiceHealth/>}
  {panel==="jobs"&&<PlatformWorkerHealth/>}
 </section>;
}
