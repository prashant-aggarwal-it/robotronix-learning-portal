"use client";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {PageIntro} from "@/components/PageIntro";
import {LearnerCalendar} from "@/components/calendar/LearnerCalendar";
import {getParentLearnerExperiences,listScheduleEvents} from "@/lib/repository";
import type {LearnerExperienceSnapshot,ScheduleEvent} from "@/lib/types";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";
import {downloadScheduleIcs} from "@/lib/calendar";

export default function ParentCalendarPage(){
 const[snapshots,setSnapshots]=useState<LearnerExperienceSnapshot[]>([]),[events,setEvents]=useState<ScheduleEvent[]>([]),[selected,setSelected]=useState(""),[loading,setLoading]=useState(true);
 async function reload(){const[s,e]=await Promise.all([getParentLearnerExperiences(),listScheduleEvents()]);setSnapshots(s);setEvents(e);setSelected(current=>current||s[0]?.learner.id||"");setLoading(false)}
 useEffect(()=>{void reload()},[]);
 useLiveRefresh(["schedule_events"],reload,"parent-calendar");
 const current=snapshots.find(s=>s.learner.id===selected)||snapshots[0];
 const[exportMessage,setExportMessage]=useState("");
 const scoped=useMemo(()=>current?events.filter(e=>e.eventType==="class"&&(e.studentId===current.learner.id||e.enrollmentId===current.enrollmentId||Boolean(current.cohortId&&e.cohortId===current.cohortId))):[],[current,events]);
 const upcomingForExport=useMemo(()=>scoped.filter(e=>["scheduled","tentative","makeup"].includes(e.status)&&e.date>=new Intl.DateTimeFormat("en-CA",{timeZone:e.timezone||"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())),[scoped]);
 function exportAll(){if(!current)return;const count=downloadScheduleIcs(upcomingForExport,current.learner.name);setExportMessage(count?`Downloaded ${count} scheduled class${count===1?"":"es"}. Import the file into Google Calendar on a computer using Settings → Import & export → Import. This is a one-time snapshot; later schedule changes will not update automatically.`:"No upcoming scheduled classes are available to export.");}
 return <RoleGuard allow={["parent"]}><AppShell role="parent">
  <main className="experiencePage">
   <PageIntro eyebrow="FAMILY CALENDAR" title="Classes at a glance" text="View confirmed classes and export the full upcoming schedule for Google Calendar, Apple Calendar or Outlook."/>
   {loading?<div className="experienceLoading">Loading family calendar…</div>:!current?<div className="experienceEmpty"><h2>No active learner calendar yet</h2><p>Classes will appear after an enrollment and schedule are activated.</p></div>:<>
    {snapshots.length>1&&<section className="panel"><div className="row between"><div><b>Viewing learner</b><p className="muted">Choose which child’s schedule to view.</p></div><select className="input compactInput" value={current.learner.id} onChange={e=>setSelected(e.target.value)}>{snapshots.map(s=><option value={s.learner.id} key={s.learner.id}>{s.learner.name}</option>)}</select></div></section>}
    <section className="panel" style={{marginBottom:16,padding:18}}>
      <div className="row between" style={{alignItems:"center",flexWrap:"wrap",gap:12}}>
       <div><h2 style={{margin:"0 0 5px",fontSize:18}}>Add the full class schedule to your calendar</h2><p className="fieldHint" style={{margin:0}}>{upcomingForExport.length} upcoming scheduled class{upcomingForExport.length===1?"":"es"} for {current.learner.name}. Download once, then import into Google Calendar.</p></div>
       <button type="button" className="button" disabled={!upcomingForExport.length} onClick={exportAll}>Download full schedule (.ics)</button>
      </div>
      <p className="fieldHint" style={{margin:"10px 0 0"}}>Google Calendar (desktop): Settings → Import & export → Import → choose the downloaded file and destination calendar. This import is not automatic syncing; check the Robotronix portal for reschedules and newly booked classes.</p>
      {exportMessage&&<div className="infoBanner" role="status" style={{marginTop:10}}>{exportMessage}</div>}
    </section>
    <LearnerCalendar events={scoped} role="parent"/>
   </>}
  </main>
 </AppShell></RoleGuard>;
}
