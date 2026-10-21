"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {generateCohortScheduleV2,listAdminCohorts,listScheduleEvents} from "@/lib/repository";
import type {CohortAdminRecord,ScheduleEvent} from "@/lib/types";

export default function CohortScheduling(){
 const[cohorts,setCohorts]=useState<CohortAdminRecord[]>([]);
 const[events,setEvents]=useState<ScheduleEvent[]>([]);
 const[selected,setSelected]=useState("");
 const[horizon,setHorizon]=useState<"full"|"weeks"|"manual">("full");
 const[weeks,setWeeks]=useState(4);
 const[busy,setBusy]=useState(false);
 const[notice,setNotice]=useState("");
 async function refresh(){const[c,e]=await Promise.all([listAdminCohorts(),listScheduleEvents()]);setCohorts(c);setEvents(e)}
 useEffect(()=>{void refresh().catch(e=>setNotice(String(e)))},[]);
 const cohort=cohorts.find(c=>c.id===selected);
 const existing=events.filter(e=>e.cohortId===selected&&e.eventType==="class");
 async function generate(){
  if(!cohort)return;
  if(!confirm("Generate shared batch class bookings? The database will reject conflicting bookings and preserve existing generated occurrences."))return;
  setBusy(true);setNotice("");
  try{
   const r=await generateCohortScheduleV2(cohort.id,horizon,horizon==="weeks"?weeks:undefined);
   setNotice(r.ok?String(r.created)+" new shared class(es) booked. "+r.total+" occurrence(s) counted.":r.error);
   if(r.ok)await refresh();
  }catch(e){setNotice(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <RoleGuard allow={["admin"]}><AppShell role="admin">
  <AdminPageHeader eyebrow="BATCH SCHEDULING" title="Generate Cohort Classes" description="One shared calendar event per batch occurrence, with individual attendance for each student." actions={<Link href="/admin/enrollments" className="button ghost">Back to Enrollments</Link>}/>
  <section className="panel">
   <div className="formGrid">
    <div className="formGroup"><label>Cohort</label><select className="input" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose cohort</option>{cohorts.filter(c=>["planned","active"].includes(c.status)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="formGroup"><label>Schedule horizon</label><select className="input" value={horizon} onChange={e=>setHorizon(e.target.value as typeof horizon)}><option value="full">Full course</option><option value="weeks">Selected weeks</option><option value="manual">Manual</option></select></div>
    {horizon==="weeks"&&<div className="formGroup"><label>Number of weeks</label><input className="input" type="number" min={1} max={104} value={weeks} onChange={e=>setWeeks(Number(e.target.value))}/></div>}
   </div>
   {cohort&&<p className="fieldHint">{cohort.name} · {cohort.studentIds.length} enrolled learner(s) · {existing.length} existing class record(s). Learner-specific breaks must not alter this batch calendar.</p>}
   {notice&&<div className="infoBanner">{notice}</div>}
   <div className="formActions"><button className="button" disabled={busy||!cohort||horizon==="manual"} onClick={generate}>{busy?"Generating…":"Generate shared classes"}</button></div>
  </section>
 </AppShell></RoleGuard>;
}
