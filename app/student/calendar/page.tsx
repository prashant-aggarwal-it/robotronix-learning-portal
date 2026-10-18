"use client";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {PageIntro} from "@/components/PageIntro";
import {LearnerCalendar} from "@/components/calendar/LearnerCalendar";
import {getStudentExperience,listScheduleEvents} from "@/lib/repository";
import type {LearnerExperienceSnapshot,ScheduleEvent} from "@/lib/types";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";

export default function StudentCalendarPage(){
 const[data,setData]=useState<LearnerExperienceSnapshot|null|undefined>(undefined),[events,setEvents]=useState<ScheduleEvent[]>([]);
 async function reload(){const[s,e]=await Promise.all([getStudentExperience(),listScheduleEvents()]);setData(s);setEvents(e)}
 useEffect(()=>{void reload()},[]);
 useLiveRefresh(["schedule_events"],reload,"student-calendar");
 const scoped=useMemo(()=>data?events.filter(e=>e.eventType==="class"&&(e.studentId===data.learner.id||e.enrollmentId===data.enrollmentId||Boolean(data.cohortId&&e.cohortId===data.cohortId))):[],[data,events]);
 return <RoleGuard allow={["student"]}><AppShell role="student">
  <main className="experiencePage">
   <PageIntro eyebrow="MY CALENDAR" title="My class schedule" text="See your Robotronix classes, join when it is time, or add a session to your personal calendar."/>
   {data===undefined?<div className="experienceLoading">Loading your calendar…</div>:!data?<div className="experienceEmpty"><h2>No active calendar yet</h2><p>Your classes will appear after your enrollment is activated.</p></div>:<LearnerCalendar events={scoped} role="student"/>}
  </main>
 </AppShell></RoleGuard>;
}
