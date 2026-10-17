"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {SessionCycleProgress} from "@/components/SessionCycleProgress";
import {RoleGuard} from "@/components/RoleGuard";
import {FeedbackCard,NextClassCard,ParentActionCard,ProjectSpotlight,learningStatusCopy} from "@/components/experience/ExperienceCards";
import {getParentLearnerExperiences,getCurrentParentSetupState} from "@/lib/repository";
import type {LearnerExperienceSnapshot} from "@/lib/types";

export default function ParentPage(){
 const[children,setChildren]=useState<LearnerExperienceSnapshot[]|undefined>(undefined);const[selectedId,setSelectedId]=useState<string>("");const[setup,setSetup]=useState<{pending:number;submitted:number}|null>(null);
 useEffect(()=>{Promise.all([getParentLearnerExperiences(),getCurrentParentSetupState()]).then(([rows,state])=>{setChildren(rows);setSetup(state);setSelectedId(current=>current||rows[0]?.learner.id||"")})},[]);
 const selected=useMemo(()=>children?.find(x=>x.learner.id===selectedId)??children?.[0],[children,selectedId]);
 return <RoleGuard allow={["parent"]}><AppShell role="parent">
  {children===undefined?<div className="experienceLoading">Loading your family learning space…</div>:!children.length?<div className="experienceEmpty premiumEmpty"><div className="experienceEmptyIcon">◎</div>{(setup?.submitted||0)>0?<><h2>Your family setup has been submitted</h2><p>We’re reviewing your learner details. Once an enrollment is activated, classes, progress, projects and mentor updates will appear here automatically.</p><div className="row"><span className="statusBadge status-planned">Pending activation</span><Link className="button ghost" href="/onboarding">+ Add another child</Link></div></>:<><h2>Set up your child’s learning profile</h2><p>Add your child’s details, learning interests and preferred class timings. You can add more than one child to the same family account.</p><Link className="button" href="/onboarding">Start Family Setup</Link></>}</div>:selected&&(()=>{
   const firstName=selected.learner.name.split(" ")[0];
   const status=learningStatusCopy(selected.learner.status);
   const attendedRecent=selected.recentClasses.filter(x=>x.attendance==="attended"||x.attendance==="late").length;
   const completedProjects=selected.projects.filter(p=>p.status==="completed").length;
   const latestProject=selected.projects[0];
   const flexible=!(Number(selected.learner.plannedHours)>0);
   const milestone=completedProjects?`${completedProjects} practical ${completedProjects===1?"project":"projects"} completed`:selected.learner.sessionsCompleted?`${selected.learner.sessionsCompleted} attended sessions building momentum`:"Learning journey ready to begin";
   return <>
   <section className="familyHero parentPulseHero">
    <div className="familyHeroCopy">
      <div className="parentIdentity"><span className="childAvatar heroAvatar">{selected.learner.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><div><span className="experienceLabel">{firstName.toUpperCase()}’S LEARNING PULSE</span><div className={`parentStatusChip ${status.tone}`}><i/>{status.label}</div></div></div>
      <h1>{selected.learner.status==="on_track"?`${firstName} is building good momentum.`:selected.learner.status==="reinforce"?`${firstName} is strengthening key concepts.`:`${firstName} has extra mentor focus right now.`}</h1>
      <p>{selected.courseTitle} · {selected.enrollmentType==="one_to_one"?"1-to-1 learning":"Cohort learning"} with mentor {selected.trainerName}</p>
      <div className="parentHeroMetrics"><div><b>{flexible?selected.learner.sessionsCompleted:`${selected.learner.progress}%`}</b><span>{flexible?"Sessions attended":"Course journey"}</span></div><div><b>{selected.learner.attendance}%</b><span>Attendance</span></div><div><b>{completedProjects}</b><span>Projects completed</span></div></div>
      <div className="parentMilestone"><span>Latest momentum</span><b>{milestone}</b></div>
    </div>
    <div className="familySwitcher"><div className="familySwitcherHead"><span>Viewing learner</span><small>{children.length>1?`${children.length} learners linked`:"Family account"}</small></div><div className="childSwitchRow">{children.map(child=><button key={child.learner.id} className={`childSwitch ${selected.learner.id===child.learner.id?"active":""}`} onClick={()=>setSelectedId(child.learner.id)}><span className="childAvatar">{child.learner.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><span><b>{child.learner.name}</b><small>{child.learner.grade} · {child.courseTitle}</small></span><span className="childSwitchArrow">→</span></button>)}</div><Link className="familyLearnerLink" href={`/parent/learner/${selected.learner.id}`}>Open {firstName}’s learner view →</Link><Link className="familyLearnerLink addLearnerLink" href="/onboarding">+ Add another child</Link></div>
   </section>

   <section className="parentStoryGrid">
    <div className="parentStoryCard highlight"><span className="experienceLabel">THIS WEEK AT ROBOTRONIX™</span><h2>Learned. Built. Improved.</h2><div className="storySteps"><div><i>01</i><span><small>Consistency</small><b>{attendedRecent?`${attendedRecent} recent ${attendedRecent===1?"class":"classes"} attended`:"Next class is the next step"}</b></span></div><div><i>02</i><span><small>Current focus</small><b>{selected.learner.nextFocus||"Keep building confidence through practice"}</b></span></div><div><i>03</i><span><small>Practical proof</small><b>{latestProject?.title||"First practical build coming up"}</b></span></div></div></div>
    <div className="parentCourseJourney"><div className="journeyTop"><div><span className="experienceLabel">{flexible?"LEARNING JOURNEY":"COURSE JOURNEY"}</span><h3>{selected.courseTitle}</h3></div><strong>{flexible?`${selected.learner.sessionsCompleted} attended`:`${selected.learner.hoursCompleted??0} / ${selected.learner.plannedHours??0} hours`}</strong></div><SessionCycleProgress hoursCompleted={selected.learner.hoursCompleted} plannedHours={selected.learner.plannedHours} attendedClasses={selected.learner.sessionsCompleted}/><div className="journeyMeta"><span>{flexible?"Hour target not set · attendance tracked separately":`${selected.learner.progress}% course complete`}</span><span>Classes attended are shown separately</span></div><Link href={`/parent/learner/${selected.learner.id}`} className="textLink">See the full learning journey →</Link></div>
   </section>

   <section className="experienceKpis parentKpis"><div className="experienceKpi kpiProgress"><span>{flexible?"Learning sessions":"Course progress"}</span><b>{flexible?selected.learner.sessionsCompleted:`${selected.learner.progress}%`}</b><small>{flexible?"Attended sessions · 8-session rhythm":`${selected.learner.hoursCompleted??0} of ${selected.learner.plannedHours??0} instructional hours · ${selected.learner.hoursRemaining??0} left`}</small></div><div className="experienceKpi kpiAttendance"><span>Attendance</span><b>{selected.learner.attendance}%</b><small>{selected.attendanceRecorded} recorded classes</small></div><div className="experienceKpi kpiProjects"><span>Practical builds</span><b>{completedProjects}</b><small>{selected.projects.length} project records</small></div><div className="experienceKpi kpiSignal"><span>Learning status</span><b className={`statusText ${selected.learner.status}`}>{status.label}</b><small>Based on recent mentor signals</small></div></section>

   <section className="experienceGrid parentDashboardGrid"><div className="experienceStack"><ParentActionCard snapshot={selected}/><FeedbackCard snapshot={selected}/></div><div className="experienceStack"><NextClassCard event={selected.nextClass} trainer={selected.trainerName}/><ProjectSpotlight snapshot={selected} href={`/parent/learner/${selected.learner.id}`}/></div></section>
   <section className="experienceSection recentLearningSection"><div className="experienceSectionHead"><div><span className="experienceLabel">RECENT LEARNING RHYTHM</span><h2>Consistency at a glance</h2><p>Attendance history stays transparent, while only attended classes move course progress forward.</p></div></div><div className="recentClassStrip">{selected.recentClasses.length?selected.recentClasses.map(item=><div className={`recentClass recent-${item.attendance}`} key={item.scheduleEventId}><span className={`attendanceDot ${item.attendance}`}/><div><b>{new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short"}).format(new Date(`${item.date}T12:00:00`))}</b><small>{item.attendance.charAt(0).toUpperCase()+item.attendance.slice(1)}</small></div></div>):<div className="experienceEmpty compact"><p>No attendance records yet.</p></div>}</div></section>
  </>})()}
 </AppShell></RoleGuard>;
}
