"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {SessionCycleProgress} from "@/components/SessionCycleProgress";
import {RoleGuard} from "@/components/RoleGuard";
import {FeedbackCard,NextClassCard,ProjectSpotlight,learningStatusCopy} from "@/components/experience/ExperienceCards";
import {getStudentExperience} from "@/lib/repository";
import type {LearnerExperienceSnapshot} from "@/lib/types";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";
export default function StudentPage(){
 const[data,setData]=useState<LearnerExperienceSnapshot|null|undefined>();
 async function reload(){setData(await getStudentExperience())}
 useEffect(()=>{void reload()},[]);
 useLiveRefresh(["schedule_events","class_attendance","learning_observations","session_records"],reload,"student-dashboard");
 const flexible=Boolean(data&&Number(data.learner.plannedHours)<=0);
 return <RoleGuard allow={["student"]}><AppShell role="student">{data===undefined?<div className="experienceLoading">Loading your learning space…</div>:!data?<div className="experienceEmpty"><div className="experienceEmptyIcon">◎</div><h2>Your learner profile is not active yet</h2><p>Independent learner login is optional. Your learning area is already available through the Family Account once Admin activates the enrollment; this separate login only works when Admin explicitly links it for an older learner.</p></div>:<>
  <section className="studentHero"><div><span className="experienceLabel">MY LEARNING DASHBOARD</span><h1>Hi {data.learner.name.split(" ")[0]}, what will you build next?</h1><p>Your dashboard keeps the next step clear—attend, build, improve and keep moving forward.</p><div className="studentHeroTags"><span>{data.courseTitle}</span><span>{data.enrollmentType==="one_to_one"?"1-to-1":"Cohort"}</span><span>Mentor {data.trainerName}</span></div></div><div className="studentProgressOrb"><div><b>{flexible?data.learner.sessionsCompleted:`${data.learner.progress}%`}</b><span>{flexible?"sessions attended":"course progress"}</span></div><small>{flexible?"8-session milestones · flexible journey":`${data.learner.hoursCompleted??0} of ${data.learner.plannedHours??0} instructional hours`}</small></div></section>
  <section className="studentActionRail"><div className="studentAction primary"><span>CONTINUE</span><h3>{data.learner.nextFocus}</h3><p>Current learning focus</p><Link href="/student/course">Open my course →</Link></div><div className="studentAction"><span>PROJECTS</span><h3>{data.projects.filter(p=>p.status==="completed").length} completed</h3><p>{data.projects.filter(p=>["in_progress","submitted"].includes(p.status)).length} currently active</p><Link href="/student/portfolio">Open portfolio →</Link></div><div className="studentAction"><span>MY STATUS</span><h3>{learningStatusCopy(data.learner.status).label}</h3><p>{data.learner.status==="on_track"?"Keep the momentum going.":"Your mentor is helping with the next step."}</p></div></section>
  <section className="experienceGrid twoColumns"><div className="experienceStack"><NextClassCard event={data.nextClass} trainer={data.trainerName}/><FeedbackCard snapshot={data}/></div><div className="experienceStack"><div className="experienceCard studentProgressCard"><div className="experienceCardBody"><span className="experienceLabel">MY PROGRESS</span><div className="studentMetric"><SessionCycleProgress hoursCompleted={data.learner.hoursCompleted} plannedHours={data.learner.plannedHours} attendedClasses={data.learner.sessionsCompleted}/></div><div className="studentMiniStats"><div><span>Attendance</span><b>{data.learner.attendance}%</b></div><div><span>Projects</span><b>{data.projects.length}</b></div><div><span>XP</span><b>{data.learner.xp}</b></div></div><small className="muted">Only verified instructional hours from attended classes count toward course progress.</small></div></div><ProjectSpotlight snapshot={data} href="/student/portfolio"/></div></section>
  {data.activeHold&&<section className="studentPause"><span>LEARNING PAUSE</span><b>Your enrollment is temporarily on hold.</b><p>Nothing is lost—your completed course hours stay exactly where they are until classes resume.</p></section>}
 </>}</AppShell></RoleGuard>
}
