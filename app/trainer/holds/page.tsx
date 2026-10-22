"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {PageIntro} from "@/components/PageIntro";
import {EnrollmentPauseControls} from "@/components/operations/EnrollmentPauseControls";
import {getTrainerDashboard,listAdminEnrollments,listAdminStudents} from "@/lib/repository";
import type {EnrollmentAdminRecord,StudentAdminRecord} from "@/lib/types";

export default function TrainerLearnerBreaks(){
 const[rows,setRows]=useState<EnrollmentAdminRecord[]>([]);
 const[students,setStudents]=useState<StudentAdminRecord[]>([]);
 const[selected,setSelected]=useState("");
 const[error,setError]=useState("");
 async function refresh(){
  const dashboard=await getTrainerDashboard();
  const [enrollments,learners]=await Promise.all([listAdminEnrollments(),listAdminStudents()]);
  setRows(enrollments.filter(e=>e.trainerId===dashboard.trainer.id&&["active","on_hold"].includes(e.status)));
  setStudents(learners);
 }
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:String(e)))},[]);
 const enrollment=rows.find(e=>e.id===selected);
 return <RoleGuard allow={["trainer"]}><AppShell role="trainer">
  <PageIntro eyebrow="LEARNER SCHEDULING" title="Class Breaks" text="Record an agreed exam or vacation break and safely move eligible future 1-to-1 sessions. Cohort learner leave does not shift or cancel the shared batch calendar."/>
  <div className="formActions"><Link href="/trainer/classes" className="button ghost">Back to Classes</Link></div>
  <section className="panel"><div className="formGroup"><label>Assigned learner</label><select className="input" value={selected} onChange={e=>{setSelected(e.target.value);setError("")}}><option value="">Choose learner</option>{rows.map(e=><option key={e.id} value={e.id}>{students.find(s=>s.id===e.studentId)?.fullName||e.studentId} · {e.status==="on_hold"?"Paused":"Active"}</option>)}</select></div></section>
  {error&&<div className="errorBanner">{error}</div>}
  {enrollment&&<EnrollmentPauseControls key={enrollment.id} enrollmentId={enrollment.id} status={enrollment.status} enrollmentType={enrollment.enrollmentType} role="trainer" onChanged={refresh}/>}
 </AppShell></RoleGuard>;
}
