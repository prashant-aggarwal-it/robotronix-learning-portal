"use client";
import Link from "next/link";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {KpiCard} from "@/components/admin/KpiCard";
import {StatusDonut} from "@/components/admin/StatusDonut";
import {MiniBars} from "@/components/admin/MiniBars";
import {listAdminCourses,listAdminEnrollments,listAdminStudents,listAdminTrainers,listLearnerProgressRows,listOnboardingSubmissions,listScheduleEvents} from "@/lib/repository";
import type {CourseAdminRecord,EnrollmentAdminRecord,LearnerProgressRow,OnboardingSubmission,ScheduleEvent,StudentAdminRecord,TrainerAdminRecord} from "@/lib/types";
import {displayLabel} from "@/lib/display";
import {currentLearnerCount} from "@/lib/operations";
import {IST_TIMEZONE,zonedRangeParts} from "@/lib/timezones";

function displayDashboardClock(v:string){const [h,m]=v.split(":").map(Number);return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;}
export default function AdminPage(){
 const[students,setStudents]=useState<StudentAdminRecord[]>([]);const[trainers,setTrainers]=useState<TrainerAdminRecord[]>([]);const[courses,setCourses]=useState<CourseAdminRecord[]>([]);const[onboarding,setOnboarding]=useState<OnboardingSubmission[]>([]);const[enrollments,setEnrollments]=useState<EnrollmentAdminRecord[]>([]);const[events,setEvents]=useState<ScheduleEvent[]>([]);const[progress,setProgress]=useState<LearnerProgressRow[]>([]);
 useEffect(()=>{Promise.all([listAdminStudents(),listAdminTrainers(),listAdminCourses(),listOnboardingSubmissions(),listAdminEnrollments(),listScheduleEvents(),listLearnerProgressRows()]).then(([s,t,c,o,e,ev,p])=>{setStudents(s);setTrainers(t);setCourses(c);setOnboarding(o);setEnrollments(e);setEvents(ev);setProgress(p)})},[]);
 const reload=async()=>{const[s,t,c,o,e,ev,p]=await Promise.all([listAdminStudents(),listAdminTrainers(),listAdminCourses(),listOnboardingSubmissions(),listAdminEnrollments(),listScheduleEvents(),listLearnerProgressRows()]);setStudents(s);setTrainers(t);setCourses(c);setOnboarding(o);setEnrollments(e);setEvents(ev);setProgress(p)}; useLiveRefresh(["students","trainers","courses","onboarding_submissions","enrollments","schedule_events","learning_observations"],reload,"admin-overview");
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:IST_TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const eventIstDate=(e:ScheduleEvent)=>zonedRangeParts(e.date,e.startTime,e.endTime,e.timezone||IST_TIMEZONE,IST_TIMEZONE).startDate;
 const activeEnrollmentRows=enrollments.filter(e=>e.status==="active");const activeLearners=currentLearnerCount(enrollments);const activeTrainers=trainers.filter(x=>x.recordStatus==="active").length;const pending=onboarding.filter(x=>x.status==="new"||x.status==="setup_pending").length;const todayClasses=events.filter(x=>{if(x.eventType!=="class"||["cancelled","rescheduled"].includes(x.status))return false;const r=zonedRangeParts(x.date,x.startTime,x.endTime,x.timezone||IST_TIMEZONE,IST_TIMEZONE);return r.startDate===today}).length;
 const learnerChannels=new Map<string,Set<string>>();for(const e of activeEnrollmentRows){const set=learnerChannels.get(e.studentId)??new Set<string>();set.add(e.deliveryChannel||"online");learnerChannels.set(e.studentId,set)}const deliveryCounts={online:0,offline:0,hybrid:0,mixed:0};learnerChannels.forEach(set=>{if(set.size>1)deliveryCounts.mixed++;else if(set.has("offline"))deliveryCounts.offline++;else if(set.has("hybrid"))deliveryCounts.hybrid++;else deliveryCounts.online++});const deliveryDetail=[deliveryCounts.online?`${deliveryCounts.online} online`:"",deliveryCounts.offline?`${deliveryCounts.offline} offline`:"",deliveryCounts.hybrid?`${deliveryCounts.hybrid} hybrid`:"",deliveryCounts.mixed?`${deliveryCounts.mixed} mixed`:""].filter(Boolean).join(" · ")||"No active learners";
 const statusSegments=[{label:"Draft",value:onboarding.filter(x=>x.status==="draft").length,color:"#8b95aa"},{label:"New",value:onboarding.filter(x=>x.status==="new").length,color:"#7c5ce3"},{label:"Setup pending",value:onboarding.filter(x=>x.status==="setup_pending").length,color:"#ffb44c"},{label:"Active",value:onboarding.filter(x=>x.status==="active").length,color:"#1e9b69"}];const onboardingStatusTotal=statusSegments.reduce((sum,x)=>sum+x.value,0);
 const courseCounts=useMemo(()=>courses.map(c=>({label:c.shortTitle||c.title,value:enrollments.filter(e=>e.courseId===c.id&&e.status==="active").length})).sort((a,b)=>b.value-a.value).slice(0,5),[courses,enrollments]);
 const todayList=events.filter(x=>eventIstDate(x)===today&&x.eventType==="class"&&!["cancelled","rescheduled"].includes(x.status)).sort((a,b)=>zonedRangeParts(a.date,a.startTime,a.endTime,a.timezone||IST_TIMEZONE,IST_TIMEZONE).startInstant.getTime()-zonedRangeParts(b.date,b.startTime,b.endTime,b.timezone||IST_TIMEZONE,IST_TIMEZONE).startInstant.getTime()).slice(0,6);const trainerName=(id:string)=>trainers.find(t=>t.id===id)?.fullName??"Trainer";
 const todayCompleted=todayList.filter(e=>e.status==="conducted").length;
 const todayUpcoming=todayList.filter(e=>e.status!=="conducted").length;
 const classIstTime=(e:ScheduleEvent)=>displayDashboardClock(zonedRangeParts(e.date,e.startTime,e.endTime,e.timezone||IST_TIMEZONE,IST_TIMEZONE).startTime);
 const activeProgress=progress.filter(r=>r.enrollmentStatus==="active");const pendingClassRecords=events.filter(e=>e.eventType==="class"&&eventIstDate(e)<today&&["scheduled","tentative","makeup"].includes(e.status)).length;const holds=enrollments.filter(e=>e.status==="on_hold").length;const unassigned=enrollments.filter(e=>e.status==="active"&&!e.trainerId).length;
 const lowSessionEnrollments=activeEnrollmentRows.filter(e=>{const target=e.plannedSessions??courses.find(c=>c.id===e.courseId)?.totalSessions??0;const remaining=target-e.sessionsCompleted;return target>0&&remaining>=0&&remaining<=4});
 const pendingTrainerAccess=trainers.filter(x=>!x.loginLinked&&x.recordStatus==="active").length;
 const newSubmissions=onboarding.filter(x=>x.status==="new").length;
 const attentionCount=[newSubmissions,pendingClassRecords,holds,pendingTrainerAccess,lowSessionEnrollments.length,unassigned].filter(n=>n>0).length;
 const birthdayRows=students.filter(s=>s.recordStatus==="active"&&s.dob).map(s=>({student:s,days:daysUntilBirthday(s.dob,today)})).filter(x=>x.days>=0&&x.days<=7).sort((a,b)=>a.days-b.days||a.student.fullName.localeCompare(b.student.fullName));
 return <RoleGuard allow={["admin"]}><AppShell role="admin">
  <AdminPageHeader eyebrow="OPERATIONS CONTROL CENTRE" title="Dashboard" description="Manage onboarding, learners, trainers, enrollments, cohorts, schedules and class delivery from one connected workspace." actions={<><Link className="button ghost" href="/admin/schedule">Open schedule</Link><Link className="button" href="/admin/onboarding">Onboarding queue</Link></>}/>
  <section className="dashboardKpis adminCommandKpis" aria-label="Key operational metrics">
   <Link href="/admin/students" className="adminKpiLink" aria-label={`View ${activeLearners} current learners`}><KpiCard label="Active learners" value={activeLearners} detail={deliveryDetail} tone="teal"/></Link>
   <Link href="/admin/enrollments" className="adminKpiLink" aria-label={`View ${activeEnrollmentRows.length} active enrollments`}><KpiCard label="Active enrollments" value={activeEnrollmentRows.length} detail="Current course assignments" tone="teal"/></Link>
   <Link href="/admin/onboarding" className="adminKpiLink" aria-label={`View ${pending} pending onboarding records`}><KpiCard label="Pending onboarding" value={pending} detail="New or setup pending" tone="amber"/></Link>
   <Link href="/admin/trainers" className="adminKpiLink" aria-label={`View ${activeTrainers} active trainers`}><KpiCard label="Active trainers" value={activeTrainers} detail={`${activeTrainers-pendingTrainerAccess} portal-ready · ${pendingTrainerAccess} need setup`} tone="slate"/></Link>
  </section>
  <section className="dashboardGrid dashboardGridTwo adminCommandGrid">
   <div className="panel adminCommandPanel">
    <div className="panelHeader"><div><div className="eyebrow">TODAY · IST</div><h2>Today's classes</h2><p>{todayList.length} shown · {todayCompleted} completed · {todayUpcoming} upcoming or pending</p></div><Link href="/admin/schedule" className="textLink">Full calendar →</Link></div>
    {todayList.length?<div className="activityList adminCommandActivity">{todayList.map(e=><Link href="/admin/classes" className="activityRow adminCommandActivityRow" key={e.id}>
      <div className="activityTime">{classIstTime(e)}</div>
      <div><b>{e.title}</b><span>{trainerName(e.trainerId)} · {displayLabel(e.status)}</span></div>
      <span className="adminClassView">View class →</span>
    </Link>)}</div>:<div className="adminCommandEmpty"><b>No classes scheduled for today</b><p>Today's schedule is clear. Check the calendar for upcoming lessons.</p><Link href="/admin/schedule" className="textLink">View schedule →</Link></div>}
   </div>
   <div className="panel adminCommandPanel">
    <div className="panelHeader"><div><div className="eyebrow">OPERATIONS</div><h2>What needs your attention</h2><p>{attentionCount? `${attentionCount} action categories require follow-up`:"No outstanding action categories"}</p></div><Link href="/admin/alerts" className="textLink">View all →</Link></div>
    <div className="actionList adminCommandActions">
     {newSubmissions>0&&<Link href="/admin/onboarding"><span className="adminAttentionDot"/><span><b>{newSubmissions} new onboarding submission{newSubmissions===1?"":"s"}</b><small>Review family details and activate learners</small></span><span className="adminAttentionArrow">→</span></Link>}
     {pendingClassRecords>0&&<Link href="/admin/classes"><span className="adminAttentionDot"/><span><b>{pendingClassRecords} classes need completion update</b><small>Record attendance or outcomes</small></span><span className="adminAttentionArrow">→</span></Link>}
     {holds>0&&<Link href="/admin/enrollments"><span className="adminAttentionDot"/><span><b>{holds} enrollment{holds===1?"":"s"} on hold</b><small>Review pauses and next actions</small></span><span className="adminAttentionArrow">→</span></Link>}
     {pendingTrainerAccess>0&&<Link href="/admin/trainers"><span className="adminAttentionDot"/><span><b>{pendingTrainerAccess} trainer{pendingTrainerAccess===1?"":"s"} need portal access</b><small>Set up or link trainer accounts</small></span><span className="adminAttentionArrow">→</span></Link>}
     {lowSessionEnrollments.length>0&&<Link href="/admin/enrollments"><span className="adminAttentionDot"/><span><b>{lowSessionEnrollments.length} enrollment{lowSessionEnrollments.length===1?"":"s"} near planned completion</b><small>Review the next course or renewal</small></span><span className="adminAttentionArrow">→</span></Link>}
     {unassigned>0&&<Link href="/admin/enrollments"><span className="adminAttentionDot"/><span><b>{unassigned} active enrollments missing trainer</b><small>Complete delivery assignments</small></span><span className="adminAttentionArrow">→</span></Link>}
     {birthdayRows.length>0&&<Link href="/admin/students"><span className="adminAttentionDot adminAttentionInfo"/><span><b>{birthdayRows.length} learner birthday{birthdayRows.length===1?"":"s"} in the next 7 days</b><small>{birthdayRows.slice(0,3).map(x=>x.student.fullName).join(" · ")}</small></span><span className="adminAttentionArrow">→</span></Link>}
     {attentionCount===0&&birthdayRows.length===0&&<div className="adminAllClear">✓ No urgent actions in the current overview.</div>}
    </div>
   </div>
  </section>
  <details className="panel optionalAnalytics"><summary>More analytics · onboarding, course mix & learning signals</summary>
  <section className="dashboardGrid dashboardGridTwo">
   <div className="panel"><div className="panelHeader"><div><div className="eyebrow">ONBOARDING</div><h2>Family onboarding pipeline</h2></div><Link href="/admin/onboarding" className="textLink">Open queue →</Link></div><StatusDonut segments={statusSegments} centerLabel="families" centerValue={onboardingStatusTotal}/></div>
   <div className="panel"><div className="panelHeader"><div><div className="eyebrow">DELIVERY MIX</div><h2>Active enrollments by course</h2></div><Link href="/admin/enrollments" className="textLink">Enrollments →</Link></div><MiniBars items={courseCounts.length?courseCounts:[{label:"No active enrollments",value:0}]}/></div>
  </section>

  <section className="dashboardGrid dashboardGridTwo">
   <div className="panel"><div className="panelHeader"><div><div className="eyebrow">LEARNER PROGRESS</div><h2>Operational progress health</h2></div><Link href="/admin/progress" className="textLink">Open progress →</Link></div><div className="summaryList"><div><span>On track</span><b>{activeProgress.filter(r=>r.currentSignal==="on_track").length}</b></div><div><span>Review next class</span><b>{activeProgress.filter(r=>r.currentSignal==="reinforce").length}</b></div><div><span>Needs follow-up</span><b>{activeProgress.filter(r=>r.currentSignal==="follow_up"||r.activeHold).length}</b></div></div></div>
   <div className="panel"><div className="panelHeader"><div><div className="eyebrow">WHY THIS VIEW</div><h2>Hours and attendance only</h2><p>Progress is based on verified instructional hours and attendance. LMS projects and curriculum-review workflows stay out until they are actually needed.</p></div></div></div>
  </section>
  </details>
 </AppShell></RoleGuard>
}


function daysUntilBirthday(dob:string,today:string){
 const [,m,d]=dob.split("-").map(Number);const [y,tm,td]=today.split("-").map(Number);if(!m||!d)return 999;const base=Date.UTC(y,tm-1,td);let target=Date.UTC(y,m-1,d);if(target<base)target=Date.UTC(y+1,m-1,d);return Math.round((target-base)/86400000);
}
