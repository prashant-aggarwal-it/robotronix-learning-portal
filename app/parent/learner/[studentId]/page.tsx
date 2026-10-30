"use client";
import Link from "next/link";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {ProgressBar} from "@/components/ProgressBar";
import {RoleGuard} from "@/components/RoleGuard";
import {FeedbackCard,NextClassCard,ProjectSpotlight,ProjectVisual,formatShortDate,learningStatusCopy} from "@/components/experience/ExperienceCards";
import {getParentLearnerExperience,getParentLearnerExperiences} from "@/lib/repository";
import type {LearnerExperienceSnapshot} from "@/lib/types";
import {displayLabel} from "@/lib/display";
import {learnerHasLearningEvidence} from "@/lib/learner-lifecycle";

export default function ParentLearnerDetail(){
 const params=useParams<{studentId:string}>();const[data,setData]=useState<LearnerExperienceSnapshot|null|undefined>(undefined);const[siblings,setSiblings]=useState<LearnerExperienceSnapshot[]>([]);
 useEffect(()=>{
  let cancelled=false;
  setData(undefined);

  getParentLearnerExperience(params.studentId).then(snapshot=>{
    if(cancelled)return;
    setData(snapshot);
  });

  getParentLearnerExperiences().then(rows=>{
    if(cancelled)return;
    setSiblings(rows);
  });

  return()=>{cancelled=true};
 },[params.studentId]);
 const reload=async()=>{const [snapshot,rows]=await Promise.all([getParentLearnerExperience(params.studentId),getParentLearnerExperiences()]);setData(snapshot);setSiblings(rows)};
useLiveRefresh(["schedule_events","class_attendance","learning_observations","session_records","learner_projects"],reload,`parent-learner-${params.studentId}`);
return <RoleGuard allow={["parent"]}><AppShell role="parent">{data===undefined?<div className="experienceLoading">Loading learner view…</div>:!data?<div className="experienceEmpty"><h2>Learner view is not available</h2><p>This learner is not linked to your family account or does not have an active enrollment.</p><Link className="button secondary" href="/parent">Return to family dashboard</Link></div>:<>
  <section className="learnerModeBanner"><div><span className="experienceLabel">LEARNER VIEW</span><h1>{data.learner.name.split(" ")[0]}’s learning space</h1><p>A learner-friendly view of current progress, projects, feedback and what comes next.</p></div><div className="row"><select className="input learnerSelect" value={data.learner.id} onChange={e=>location.href=`/parent/learner/${e.target.value}`}>{siblings.map(s=><option value={s.learner.id} key={s.learner.id}>{s.learner.name}</option>)}</select><Link className="button ghost" href="/parent">Exit learner view</Link></div></section>
  <section className="learnerCourseHero"><div><span className="experienceLabel">MY LEARNING JOURNEY</span><h2>{data.courseTitle}</h2><p>Mentor {data.trainerName} · {data.enrollmentType==="one_to_one"?"1-to-1":"Cohort"}</p></div>{Number(data.learner.plannedHours)>0?<><div className="courseRing" style={{background:`conic-gradient(#744ed2 0 ${data.learner.progress}%, #ececf3 ${data.learner.progress}% 100%)`}}><div><b>{data.learner.progress}%</b><span>progress</span></div></div><div className="courseProgressCopy"><b>{data.learner.hoursCompleted??0} of {data.learner.plannedHours??0} instructional hours completed</b><ProgressBar value={data.learner.progress}/><small>Actual verified teaching hours count only when the learner attends.</small></div></>:<><div className="courseRing flexibleRing"><div><b>{data.learner.sessionsCompleted}</b><span>attended</span></div></div><div className="courseProgressCopy"><b>{data.learner.sessionsCompleted} learning sessions attended</b><p>Progress is tracked through sessions, projects, skills and mentor notes rather than an artificial course percentage.</p><small>Class attendance is tracked separately from course hours.</small></div></>}</section>
  <section className="experienceKpis learnerKpis"><div className="experienceKpi"><span>Attendance</span><b>{data.learner.attendance}%</b><small>{data.attendanceRecorded} classes with attendance recorded</small></div><div className="experienceKpi"><span>Projects</span><b>{data.projects.filter(p=>p.status==="completed").length}</b><small>Completed builds</small></div><div className="experienceKpi"><span>XP</span><b>{data.learner.xp}</b><small>Learning achievements</small></div><div className="experienceKpi"><span>Status</span><b className={`statusText ${data.learner.status}`}>{learnerHasLearningEvidence(data)?learningStatusCopy(data.learner.status).label:"Not enough evidence"}</b><small>Current mentor signal</small></div></section>
  {data.activeHold&&<section className="learnerHold"><div><span className="experienceLabel">LEARNING PAUSE</span><h3>Enrollment temporarily on hold</h3><p>{data.activeHold.reason.charAt(0).toUpperCase()+data.activeHold.reason.slice(1)}{data.activeHold.endDate?` · planned return after ${formatShortDate(data.activeHold.endDate)}`:""}</p></div></section>}
  <section className="experienceGrid twoColumns"><div className="experienceStack"><NextClassCard event={data.nextClass} trainer={data.trainerName}/><FeedbackCard snapshot={data}/></div><div className="experienceStack"><ProjectSpotlight snapshot={data}/><div className="experienceCard"><div className="experienceCardBody"><span className="experienceLabel">MY RECENT CLASSES</span><h3>Learning consistency</h3><div className="learnerAttendanceList">{data.recentClasses.length?data.recentClasses.map(c=><div key={c.scheduleEventId}><span className={`attendanceDot ${c.attendance}`}/><b>{formatShortDate(c.date)}</b><span>{c.attendance.charAt(0).toUpperCase()+c.attendance.slice(1)}</span></div>):<p className="muted">No attendance history yet.</p>}</div></div></div></div></section>
  <section className="experienceSection"><div className="experienceSectionHead"><div><span className="experienceLabel">MY PROJECTS</span><h2>Things I’m building</h2><p>Projects are the visible proof of concepts applied in practice.</p></div></div><div className="projectExperienceGrid">{data.projects.length?data.projects.map(p=><article className="learnerProjectCard" key={p.id}><div className="row between"><span className={`statusBadge status-${p.status}`}>{displayLabel(p.status)}</span><small>{displayLabel(p.type)}</small></div><ProjectVisual title={p.title} compact/><h3>{p.title}</h3><div className="tagRow">{p.skills.map(skill=><span className="softBadge" key={skill}>{skill}</span>)}</div>{p.trainerFeedback&&<p>{p.trainerFeedback}</p>}</article>):<div className="experienceEmpty compact"><p>Project milestones will appear here as they begin.</p></div>}</div></section>
 </>}</AppShell></RoleGuard>;
}