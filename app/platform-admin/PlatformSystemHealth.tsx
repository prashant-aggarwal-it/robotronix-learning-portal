"use client";
import {useState} from "react";
import PlatformEmailHealth from "./PlatformEmailHealth";
import PlatformAdminSafety from "./PlatformAdminSafety";

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
   <article className="platformPanel platformMonitorTile"><h3>Application & APIs</h3><strong>Status not monitored</strong><p>Service connectivity and API latency checks are scheduled for Phase 9B.</p><button type="button" onClick={()=>setPanel("services")}>Service coverage</button></article>
   <article className="platformPanel platformMonitorTile"><h3>Email delivery</h3><strong>Available in Email monitoring</strong><p>View recorded queue, provider-acceptance and failure counts.</p><button type="button" onClick={()=>setPanel("email")}>View email monitoring</button></article>
   <article className="platformPanel platformMonitorTile"><h3>Jobs & workers</h3><strong>Heartbeat not monitored</strong><p>Worker timing and stalled-job monitoring are planned for Phase 9C.</p><button type="button" onClick={()=>setPanel("jobs")}>Job coverage</button></article>
   <article className="platformPanel platformMonitorTile"><h3>Administrator audit</h3><strong>Existing records available</strong><p>Inspect privileged administrator changes and verified access.</p><button type="button" onClick={()=>setPanel("security")}>View audit</button></article>
  </div>}
  {panel==="email"&&<PlatformEmailHealth/>}
  {panel==="security"&&<PlatformAdminSafety/>}
  {panel==="services"&&<section className="platformPanel platformMonitorPlaceholder"><h3>Services & APIs</h3><p>Live uptime, database probes, request latency and API error trends are not measured by Phase 9A. No green status is displayed until Phase 9B adds real checks.</p></section>}
  {panel==="jobs"&&<section className="platformPanel platformMonitorPlaceholder"><h3>Background jobs</h3><p>The email monitoring tab includes recorded queue counts. Worker heartbeat, oldest pending job and retry-age checks are not yet available; Phase 9C will provide these measurements.</p><button type="button" onClick={()=>setPanel("email")}>View existing email queue counts</button></section>}
 </section>;
}
