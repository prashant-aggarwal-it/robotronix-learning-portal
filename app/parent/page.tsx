"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {SessionCycleProgress} from "@/components/SessionCycleProgress";
import {RoleGuard} from "@/components/RoleGuard";
import {FeedbackCard,NextClassCard,ParentActionCard,ProjectSpotlight} from "@/components/experience/ExperienceCards";
import {getParentLearnerExperiences,getCurrentParentSetupState} from "@/lib/repository";
import type {LearnerExperienceSnapshot} from "@/lib/types";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";

export default function ParentPage(){
 const[children,setChildren]=useState<LearnerExperienceSnapshot[]|undefined>(undefined);const[selectedId,setSelectedId]=useState<string>("");const[setup,setSetup]=useState<{pending:number;submitted:number}|null>(null);
 async function reload(){const[rows,state]=await Promise.all([getParentLearnerExperiences(),getCurrentParentSetupState()]);setChildren(rows);setSetup(state);setSelectedId(current=>current||rows[0]?.learner.id||"")}
 useEffect(()=>{void reload()},[]);
 useLiveRefresh(["schedule_events","class_attendance","learning_observations","session_records"],reload,"parent-dashboard");
 const selected=useMemo(()=>children?.find(x=>x.learner.id===selectedId)??children?.[0],[children,selectedId]);
 return <RoleGuard allow={["parent"]}><AppShell role="parent">
  {Boolean(setup?.pending)&&Boolean(children?.length)&&<div className="infoBanner" role="status" style={{marginBottom:16}}><b>{setup?.pending} learner setup{setup?.pending===1?" is":"s are"} awaiting activation.</b> Your active learners remain available below. Submitted learner details will appear here after Admin completes enrollment. <Link href="/onboarding" className="textLink">Add another child →</Link></div>}
  {children===undefined?<div className="experienceLoading">Loading your family learning space…</div>:!children.length?<div className="experienceEmpty premiumEmpty"><div className="experienceEmptyIcon">◎</div>{(setup?.submitted||0)>0?<><h2>Your family setup has been submitted</h2><p>We’re reviewing your learner details. Once an enrollment is activated, classes, progress, projects and mentor updates will appear here automatically.</p><div className="row"><span className="statusBadge status-planned">{setup?.pending?"Awaiting Admin activation":"Setup submitted"}</span><Link className="button ghost" href="/onboarding">+ Add another child</Link></div></>:<><h2>Set up your child’s learning profile</h2><p>Add your child’s details, learning interests and preferred class timings. You can add more than one child to the same family account.</p><Link className="button" href="/onboarding">Start Family Setup</Link></>}</div>:selected&&(()=>{
   const firstName=selected.learner.name.split(" ")[0];
   const noLessonsYet=selected.learner.sessionsCompleted===0&&(selected.learner.hoursCompleted??0)===0;
   const completedProjects=selected.projects.filter(p=>p.status==="completed").length;
   const flexible=!(Number(selected.learner.plannedHours)>0);
   return <>
    <div className="parentRefresh">
      <div><span className="parentEyebrow">FAMILY DASHBOARD</span><h1>{firstName}'s learning hub</h1><p>{selected.courseTitle} · {selected.enrollmentType==="one_to_one"?"1-to-1 learning":"Cohort learning"} · Mentor {selected.trainerName}</p></div>
      <Link className="parentLinkButton" href="/parent/calendar">View calendar →</Link>
    </div>
    <div className="parentLearnerStrip" aria-label="Choose learner">
      <div className="parentLearnerChoices">{children.map(child=><button type="button" key={child.learner.id} className={`parentLearnerChoice ${selected.learner.id===child.learner.id?"selected":""}`} aria-pressed={selected.learner.id===child.learner.id} onClick={()=>setSelectedId(child.learner.id)}><span className="parentLearnerAvatar">{child.learner.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><span><b>{child.learner.name}</b><small>{child.learner.grade}</small></span></button>)}</div>
      <Link href="/onboarding" className="parentLinkButton">+ Add another child</Link>
    </div>
    <div className="parentPriorityGrid">
      <section className="parentPrimaryClass" aria-label="Your next class">
        <NextClassCard event={selected.nextClass} trainer={selected.trainerName}/>
      </section>
      <section className="parentJourneySummary" aria-label="Course progress">
        <div className="parentSummaryTitle"><div><span className="parentEyebrow">LEARNING PROGRESS</span><h2>{selected.courseTitle}</h2></div><Link href={`/parent/learner/${selected.learner.id}`} className="parentInlineLink">Full journey →</Link></div>
        <div className="parentBigProgress"><strong>{flexible?`${selected.learner.sessionsCompleted}`:`${selected.learner.progress}%`}</strong><span>{flexible?"classes attended":"course completed"}</span></div>
        <SessionCycleProgress hoursCompleted={selected.learner.hoursCompleted} plannedHours={selected.learner.plannedHours} attendedClasses={selected.learner.sessionsCompleted}/>
        <p>{flexible?"Learning hours will appear when the course plan is available.":`${selected.learner.hoursCompleted??0} of ${selected.learner.plannedHours??0} instructional hours delivered`}</p>
        <div className="parentQuickStats"><div><b>{selected.attendanceRecorded?selected.learner.attendance+"%":"—"}</b><span>Attendance</span><small>{selected.attendanceRecorded?selected.attendanceRecorded+" recorded classes":"No classes recorded"}</small></div><div><b>{completedProjects}</b><span>Projects completed</span><small>{completedProjects?"Keep creating":"First build ahead"}</small></div></div>
      </section>
    </div>
    <section className="parentLearningNow">
      <div className="parentSectionHeading"><span className="parentEyebrow">YOUR CHILD'S LEARNING</span><h2>{noLessonsYet?"An exciting start is ahead":"What has been happening"}</h2><p>{noLessonsYet?"Once classes begin, you'll see meaningful updates here rather than empty progress cards.":"Follow mentor feedback, class learning and practical projects in one place."}</p></div>
      <div className="parentLearningCards"><FeedbackCard snapshot={selected}/><ProjectSpotlight snapshot={selected} href={`/parent/learner/${selected.learner.id}`}/></div>
    </section>
    <section className="parentSupportRow"><ParentActionCard snapshot={selected}/><div className="parentSupportQuick"><span className="parentEyebrow">NEED HELP?</span><h3>Your family support space</h3><p>Ask about classes, schedules or your child's learning.</p><Link href="/parent/messages" className="parentLinkButton">Open messages →</Link></div></section>
    <section className="parentRecentHistory"><div className="parentSectionHeading"><span className="parentEyebrow">RECENT CLASSES</span><h2>Attendance at a glance</h2></div><div className="recentClassStrip">{selected.recentClasses.length?selected.recentClasses.map(item=><div className={`recentClass recent-${item.attendance}`} key={item.scheduleEventId}><span className={`attendanceDot ${item.attendance}`}/><div><b>{new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short"}).format(new Date(`${item.date}T12:00:00`))}</b><small>{item.attendance.charAt(0).toUpperCase()+item.attendance.slice(1)}</small></div></div>):<p className="parentQuietEmpty">Attendance history will appear after your child's first class.</p>}</div></section>
    </>})()}
 </AppShell></RoleGuard>;
}
