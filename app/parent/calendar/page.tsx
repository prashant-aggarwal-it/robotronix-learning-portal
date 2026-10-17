"use client";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {PageIntro} from "@/components/PageIntro";
import {LearnerCalendar} from "@/components/calendar/LearnerCalendar";
import {getParentLearnerExperiences,listScheduleEvents} from "@/lib/repository";
import type {LearnerExperienceSnapshot,ScheduleEvent} from "@/lib/types";

export default function ParentCalendarPage(){
 const[snapshots,setSnapshots]=useState<LearnerExperienceSnapshot[]>([]),[events,setEvents]=useState<ScheduleEvent[]>([]),[selected,setSelected]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{Promise.all([getParentLearnerExperiences(),listScheduleEvents()]).then(([s,e])=>{setSnapshots(s);setEvents(e);setSelected(s[0]?.learner.id||"");setLoading(false)})},[]);
 const current=snapshots.find(s=>s.learner.id===selected)||snapshots[0];
 const scoped=useMemo(()=>current?events.filter(e=>e.eventType==="class"&&(e.studentId===current.learner.id||e.enrollmentId===current.enrollmentId||Boolean(current.cohortId&&e.cohortId===current.cohortId))):[],[current,events]);
 return <RoleGuard allow={["parent"]}><AppShell role="parent">
  <main className="experiencePage">
   <PageIntro eyebrow="FAMILY CALENDAR" title="Classes at a glance" text="See upcoming Robotronix classes in one place and add any confirmed session to Google Calendar, Apple Calendar or Outlook."/>
   {loading?<div className="experienceLoading">Loading family calendar…</div>:!current?<div className="experienceEmpty"><h2>No active learner calendar yet</h2><p>Classes will appear after an enrollment and schedule are activated.</p></div>:<>
    {snapshots.length>1&&<section className="panel"><div className="row between"><div><b>Viewing learner</b><p className="muted">Choose which child’s schedule to view.</p></div><select className="input compactInput" value={current.learner.id} onChange={e=>setSelected(e.target.value)}>{snapshots.map(s=><option value={s.learner.id} key={s.learner.id}>{s.learner.name}</option>)}</select></div></section>}
    <LearnerCalendar events={scoped} role="parent"/>
   </>}
  </main>
 </AppShell></RoleGuard>;
}
