"use client";
import Link from "next/link";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {formatShortDate,formatTime} from "@/components/experience/ExperienceCards";
import {getTrainerDashboard,listLearnerProgressRows,listLearnerProjects,listProgressAlerts,listScheduleEvents,listTrainerEarnings} from "@/lib/repository";
import type {BatchSummary,LearnerProgressRow,LearnerProjectRecord,LearnerSummary,ProgressAlertRecord,ScheduleEvent,TrainerSummary,TrainerEarningRecord} from "@/lib/types";
import {todayIstDate} from "@/lib/ist-date";
import {zonedRangeParts,IST_TIMEZONE} from "@/lib/timezones";
import {displayLabel,learningSignalLabel} from "@/lib/display";
type Data={trainer:TrainerSummary;learners:LearnerSummary[];batches:BatchSummary[]};
export default function TrainerPage(){
 const[data,setData]=useState<Data|undefined>();const[events,setEvents]=useState<ScheduleEvent[]>([]);const[earnings,setEarnings]=useState<TrainerEarningRecord[]>([]);const[progress,setProgress]=useState<LearnerProgressRow[]>([]);const[alerts,setAlerts]=useState<ProgressAlertRecord[]>([]);const[projects,setProjects]=useState<LearnerProjectRecord[]>([]);const[q,setQ]=useState("");
 useEffect(()=>{getTrainerDashboard().then(async d=>{setData(d);if(!d.trainer.id)return;const[e,p,a,pr,er]=await Promise.all([listScheduleEvents(d.trainer.id),listLearnerProgressRows(d.trainer.id),listProgressAlerts(d.trainer.id),listLearnerProjects({trainerId:d.trainer.id}),listTrainerEarnings({trainerId:d.trainer.id})]);setEvents(e);setProgress(p);setAlerts(a.filter(x=>x.status==="open"||x.status==="reviewed"));setProjects(pr);setEarnings(er)})},[]);
 const reload=async()=>{const d=await getTrainerDashboard();setData(d);if(!d.trainer.id)return;const[e,p,a,pr,er]=await Promise.all([listScheduleEvents(d.trainer.id),listLearnerProgressRows(d.trainer.id),listProgressAlerts(d.trainer.id),listLearnerProjects({trainerId:d.trainer.id}),listTrainerEarnings({trainerId:d.trainer.id})]);setEvents(e);setProgress(p);setAlerts(a.filter(x=>x.status==="open"||x.status==="reviewed"));setProjects(pr);setEarnings(er)};useLiveRefresh(["enrollments","cohorts","schedule_events","class_attendance","learning_observations","learner_projects","trainer_earnings"],reload,"trainer-overview");

 const today=todayIstDate();
 const now=Date.now();
 const startOf=(e:ScheduleEvent)=>zonedRangeParts(e.date,e.startTime,e.endTime,e.timezone||IST_TIMEZONE,IST_TIMEZONE).startInstant.getTime();
 const endOf=(e:ScheduleEvent)=>zonedRangeParts(e.date,e.startTime,e.endTime,e.timezone||IST_TIMEZONE,IST_TIMEZONE).endInstant.getTime();
 const todayClasses=events.filter(e=>e.eventType==="class"&&zonedRangeParts(e.date,e.startTime,e.endTime,e.timezone||IST_TIMEZONE,IST_TIMEZONE).startDate===today&&!["cancelled","rescheduled","blocked"].includes(e.status)).sort((a,b)=>startOf(a)-startOf(b));
 const upcomingClasses=events.filter(e=>e.eventType==="class"&&["scheduled","tentative","makeup"].includes(e.status)&&endOf(e)>now).sort((a,b)=>startOf(a)-startOf(b));
 const nextClass=upcomingClasses[0];
 const pendingWrapups=events.filter(e=>e.eventType==="class"&&e.status==="scheduled"&&endOf(e)<now).sort((a,b)=>endOf(a)-endOf(b));
 const pendingProjects=projects.filter(p=>p.status==="submitted");
 const openAlerts=alerts.filter(a=>a.status==="open"||a.status==="reviewed");
 const activeLearnerIds=new Set(data?.learners.map(l=>l.id)||[]);
 const activeLearners=activeLearnerIds.size;
 const reviewLearnerIds=new Set(openAlerts.map(a=>a.studentId));
 const pendingActions=pendingWrapups.length+pendingProjects.length+openAlerts.length;
 const filtered=useMemo(()=>progress.filter(r=>`${r.studentName} ${r.courseTitle} ${r.grade}`.toLowerCase().includes(q.toLowerCase())).slice(0,8),[progress,q]);
 const classTime=(e:ScheduleEvent)=>formatTime(zonedRangeParts(e.date,e.startTime,e.endTime,e.timezone||IST_TIMEZONE,IST_TIMEZONE).startTime)+" IST";
 const attentionItems=[
   ...pendingWrapups.map(e=>({id:"class-"+e.id,href:`/trainer/classes/${encodeURIComponent(e.id)}`,title:"Class wrap-up pending",detail:`${e.title} · ${formatShortDate(e.date)} · Complete attendance and learner update`,kind:"class"})),
   ...pendingProjects.map(p=>({id:"project-"+p.id,href:"/trainer/projects",title:"Project review pending",detail:"A submitted project needs feedback.",kind:"project"})),
   ...openAlerts.map(a=>({id:"alert-"+a.ruleKey+"-"+a.studentId,href:`/trainer/progress/${a.studentId}`,title:a.title.replace(/ · .*/,""),detail:a.detail,kind:"alert"}))
 ];
 return <RoleGuard allow={["trainer"]}><AppShell role="trainer">{!data?<div className="experienceLoading">Loading your trainer workspace…</div>:<>
  <section className="trainerExperienceHero trainerPremiumHero trainerCommandHero"><div><span className="experienceLabel">TRAINER WORKSPACE</span><h1>Teaching overview</h1><p>Your classes, learners and teaching priorities in one place.</p></div><Link className="button ghost" href="/trainer/schedule">Open schedule →</Link></section>
  <section className="trainerActionGrid trainerPremiumMetrics trainerCommandMetrics" aria-label="Trainer operational metrics">
   <Link className="trainerActionCard" href="/trainer/classes"><span>CLASSES TODAY</span><b>{todayClasses.length}</b><p>{todayClasses.length? `${todayClasses.filter(e=>e.status==="conducted").length} completed · ${todayClasses.filter(e=>e.status!=="conducted").length} remaining`:"No classes scheduled today"}</p><i>View classes →</i></Link>
   <Link className={`trainerActionCard ${pendingActions?"attention":""}`} href="#trainer-attention"><span>PENDING ACTIONS</span><b>{pendingActions}</b><p>{pendingActions?"Class, project or learner follow-ups":"All caught up"}</p><i>Review actions ↓</i></Link>
   <Link className="trainerActionCard" href="/trainer/progress"><span>ASSIGNED LEARNERS</span><b>{activeLearners}</b><p>{activeLearners?"View learning and attendance":"Awaiting learner assignments"}</p><i>View learners →</i></Link>
  </section>
  {!activeLearners&&<section className="trainerCommandNotice" role="status"><div><b>Your teaching workspace is ready</b><p>No learners are assigned yet. Once Admin activates an enrollment and assigns you, classes and progress updates will appear here.</p></div><Link href="/trainer/schedule" className="textLink">View schedule →</Link></section>}
  <section className="trainerCommandColumns" aria-label="Teaching schedule and actions">
   <div className="experienceCard trainerCommandSchedule"><div className="experienceCardBody">
    <div className="trainerCommandSectionTitle"><div><span className="experienceLabel">TEACHING SCHEDULE</span><h2>Today's classes</h2><p>{todayClasses.length? `${todayClasses.length} class${todayClasses.length===1?"":"es"} today`:"No classes scheduled today"}</p></div><Link href="/trainer/schedule" className="textLink">Full calendar →</Link></div>
    {todayClasses.length?<div className="trainerCommandList">{todayClasses.slice(0,5).map(e=><Link href={`/trainer/classes/${encodeURIComponent(e.id)}`} key={e.id} className="trainerCommandLine"><span className="trainerCommandTime">{classTime(e)}</span><span><b>{e.title}</b><small>{displayLabel(e.status)}</small></span><strong>View class →</strong></Link>)}</div>:<div className="trainerCommandEmpty"><b>Clear schedule for today</b><p>Your booked sessions will appear here. Use the calendar to see future classes.</p></div>}
    {nextClass&&<div className="trainerCommandNext"><span>NEXT UPCOMING CLASS</span><b>{formatShortDate(nextClass.date)} · {classTime(nextClass)}</b><Link href={`/trainer/classes/${encodeURIComponent(nextClass.id)}`}>View details →</Link></div>}
   </div></div>
   <div className="experienceCard trainerCommandAttention" id="trainer-attention"><div className="experienceCardBody">
    <div className="trainerCommandSectionTitle"><div><span className="experienceLabel">PRIORITY QUEUE</span><h2>What needs attention</h2><p>{pendingActions? `${pendingActions} recorded follow-up${pendingActions===1?"":"s"}`:"No pending actions"}</p></div></div>
    {attentionItems.length?<div className="trainerCommandList">{attentionItems.slice(0,6).map(item=><Link className="trainerCommandLine" href={item.href} key={item.id}><span className="trainerCommandTaskIcon" aria-hidden="true">!</span><span><b>{item.title}</b><small>{item.detail}</small></span><strong>Open →</strong></Link>)}{attentionItems.length>6&&<p className="trainerCommandMore">Showing 6 of {attentionItems.length} actions. Use Classes, Projects and Learner Progress to review the rest.</p>}</div>:<div className="trainerCommandEmpty trainerCommandAllClear"><b>All caught up</b><p>No class wrap-ups, submitted projects or learner alerts need attention.</p></div>}
   </div></div>
  </section>
  {progress.length>0&&<section className="trainerCommandLearning"><div className="experienceSectionHead"><div><span className="experienceLabel">MY LEARNERS</span><h2>Learning pulse</h2><p>Progress, attendance and recent learning signals.</p></div><input className="input compactSearch" aria-label="Search learners" placeholder="Search learner or course…" value={q} onChange={e=>setQ(e.target.value)}/></div>
   <div className="trainerLearnerTable trainerPremiumLearnerTable"><div className="trainerLearnerHead"><span>Learner</span><span>Progress</span><span>Attendance</span><span>Status</span><span/></div>{filtered.length?filtered.map(r=><div className="trainerLearnerRow" key={r.enrollmentId}><div><b>{r.studentName}</b><small>{r.grade} · {r.courseTitle}</small></div><div><b>{r.progressPercent}%</b><small>{r.hoursCompleted??0}/{r.plannedHours??0} hrs · {r.sessionsAttended} attended sessions</small></div><div><b>{r.attendanceRate}%</b><small>{r.absentCount} absent</small></div><div><span className={`statusBadge status-${r.currentSignal}`}>{learningSignalLabel(r.currentSignal)}</span></div><Link className="tableAction" href={`/trainer/progress/${r.studentId}`}>Open →</Link></div>):<div className="experienceEmpty compact"><p>No learners match this search.</p></div>}</div><Link className="textLink" href="/trainer/progress">View all learner progress →</Link>
  </section>}
  {data.batches.length>0&&<section className="trainerCommandCohorts experienceCard"><div className="experienceCardBody"><span className="experienceLabel">MY COHORTS</span><h2>{data.batches.length} active {data.batches.length===1?"cohort":"cohorts"}</h2><div className="cohortMiniList">{data.batches.map(c=><div key={c.id}><b>{c.name}</b><span>{c.schedule} · {c.learnerCount} learners</span></div>)}</div></div></section>}
 </>}</AppShell></RoleGuard>;
}