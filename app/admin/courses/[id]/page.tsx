"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {KpiCard} from "@/components/admin/KpiCard";
import {CourseForm} from "@/components/admin/CourseForm";
import {getAdminCourse,listAdminCohorts,listAdminEnrollments,listAdminTrainers} from "@/lib/repository";
import type {CohortAdminRecord,CourseAdminRecord,EnrollmentAdminRecord,TrainerAdminRecord} from "@/lib/types";
import {displayLabel} from "@/lib/display";
import {isRunningCohort,isUpcomingCohort,operationalCohortLabel} from "@/lib/cohort-status";

export default function EditCourse(){
 const{id}=useParams<{id:string}>();const[record,setRecord]=useState<CourseAdminRecord|null|undefined>(undefined);const[enrollments,setEnrollments]=useState<EnrollmentAdminRecord[]>([]);const[cohorts,setCohorts]=useState<CohortAdminRecord[]>([]);const[trainers,setTrainers]=useState<TrainerAdminRecord[]>([]);const[tab,setTab]=useState<"overview"|"setup">("overview");
 useEffect(()=>{Promise.all([getAdminCourse(id),listAdminEnrollments(),listAdminCohorts(),listAdminTrainers()]).then(([r,e,h,t])=>{setRecord(r);setEnrollments(e.filter(x=>x.courseId===id));setCohorts(h.filter(x=>x.courseId===id));setTrainers(t)})},[id]);
 if(record===undefined)return <RoleGuard allow={["admin"]}><AppShell role="admin"><div className="panel">Loading course…</div></AppShell></RoleGuard>;
 if(!record)return <RoleGuard allow={["admin"]}><AppShell role="admin"><div className="emptyState">Course not found.</div></AppShell></RoleGuard>;
 const active=enrollments.filter(e=>e.status==="active");const one=active.filter(e=>e.enrollmentType==="one_to_one");const group=active.filter(e=>e.enrollmentType==="small_group");const runningCohorts=cohorts.filter(isRunningCohort);const upcomingCohorts=cohorts.filter(isUpcomingCohort);
 const permittedTrainers=useMemo(()=>trainers.filter(t=>t.courseIds.includes(record.id)),[trainers,record.id]);const trainerName=(x:string)=>trainers.find(t=>t.id===x)?.fullName||"Unassigned";
 return <RoleGuard allow={["admin"]}><AppShell role="admin">
  <AdminPageHeader eyebrow="PROGRAM / COURSE MASTER" title={record.publicName||record.title} description={`${record.code} · ${record.internalName||record.shortTitle} · ${record.category} · Grades ${record.gradeFrom}–${record.gradeTo}`} actions={<><Link href={`/admin/enrollments?course=${record.id}`} className="button ghost">View enrollments</Link><Link href="/admin/courses" className="button ghost">Back to courses</Link></>}/>
  <div className="tabRow professionalTabs entityTabs"><button className={`tabButton ${tab==="overview"?"active":""}`} onClick={()=>setTab("overview")}>Overview & delivery</button><button className={`tabButton ${tab==="setup"?"active":""}`} onClick={()=>setTab("setup")}>Course setup</button></div>{tab==="overview"&&<><section className="courseIdentityBanner"><div><span className="eyebrow">PARENT-FACING OUTCOME</span><h2>{record.outcomeSubtitle||"Outcome statement not set"}</h2><p>{record.description}</p></div><div className="courseIdentityMeta"><span>Public name <b>{record.publicName||record.title}</b></span><span>Internal / technical <b>{record.internalName||record.shortTitle}</b></span><span>Code <b>{record.code}</b></span></div></section>
  <section className="dashboardKpis"><KpiCard label="Active learners" value={active.length} detail={`${one.length} one-to-one · ${group.length} cohort`} tone="purple"/><KpiCard label="Running cohorts" value={runningCohorts.length} detail={`${runningCohorts.reduce((n,c)=>n+c.studentIds.length,0)} students · ${upcomingCohorts.length} upcoming`} tone="teal"/><KpiCard label="Approved trainers" value={permittedTrainers.filter(t=>t.recordStatus==="active").length} detail="Active trainers approved to teach this course" tone="amber"/><KpiCard label="Enrollment history" value={enrollments.length} detail={`${enrollments.filter(e=>e.status==="completed").length} completed`} tone="slate"/></section>
  <section className="dashboardGrid"><div className="dataSection"><div className="panelHeader"><div><div className="eyebrow">DELIVERY SNAPSHOT</div><h2>Cohort delivery</h2><p>Cohorts are shown once; individual learner history remains on each enrollment.</p></div></div><div className="tableWrap professionalTable"><table><thead><tr><th>Cohort</th><th>Trainer</th><th>Schedule</th><th>Learners / capacity</th><th>Status</th></tr></thead><tbody>{cohorts.length?cohorts.map(c=><tr key={c.id}><td><Link className="tableAction" href={`/admin/cohorts/${c.id}`}><b>{c.name}</b></Link><div className="cellSub">{c.code}</div></td><td>{trainerName(c.trainerId)}</td><td>{c.schedule}</td><td>{c.studentIds.length}</td><td>{c.studentIds.length}/{c.capacity}</td><td><span className={`statusBadge status-${isRunningCohort(c)?"active":isUpcomingCohort(c)?"planned":c.status}`}>{operationalCohortLabel(c)}</span></td></tr>):<tr><td colSpan={6}><div className="emptyState compact">No cohorts for this program.</div></td></tr>}</tbody></table></div></div>
   <div className="panel"><div className="panelHeader"><div><h2>Trainer coverage</h2></div><Link href="/admin/trainers" className="button ghost">Manage trainers</Link></div><div className="miniList separatedMiniList">{permittedTrainers.length?permittedTrainers.map(t=><div key={t.id}><span>{t.fullName}</span><b>{active.filter(e=>e.trainerId===t.id).length} active learners</b></div>):<div className="emptyState compact">No approved trainers yet.</div>}</div></div>
  </section>
  </>}{tab==="setup"&&<section className="panel formPanel"><CourseForm record={record}/></section>}
 </AppShell></RoleGuard>
}