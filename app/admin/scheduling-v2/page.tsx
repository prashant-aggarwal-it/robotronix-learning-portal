"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {generateEnrollmentScheduleV2,reassignEnrollmentTrainerV2,listAdminCourses,listAdminEnrollments,listAdminStudents,listAdminTrainers,listScheduleEvents} from "@/lib/repository";
import {previewCourseSchedule,type SchedulingHorizon} from "@/lib/scheduling-v2-preview";
import {EnrollmentPauseControls} from "@/components/operations/EnrollmentPauseControls";
import type {CourseAdminRecord,EnrollmentAdminRecord,ScheduleEvent,StudentAdminRecord,TrainerAdminRecord} from "@/lib/types";

export default function SchedulingV2Admin(){
 const [enrollments,setEnrollments]=useState<EnrollmentAdminRecord[]>([]);
 const [students,setStudents]=useState<StudentAdminRecord[]>([]);
 const [courses,setCourses]=useState<CourseAdminRecord[]>([]);
 const [trainers,setTrainers]=useState<TrainerAdminRecord[]>([]);
 const [events,setEvents]=useState<ScheduleEvent[]>([]);
 const [selected,setSelected]=useState("");
 const [replacement,setReplacement]=useState("");
 const [reason,setReason]=useState("");
 const [horizon,setHorizon]=useState<SchedulingHorizon>("full");
 const [weeks,setWeeks]=useState(4);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 async function refresh(){
  const [e,s,c,v,t]=await Promise.all([listAdminEnrollments(),listAdminStudents(),listAdminCourses(),listScheduleEvents(),listAdminTrainers()]);
  setEnrollments(e);setStudents(s);setCourses(c);setEvents(v);setTrainers(t);
 }
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:String(e)))},[]);
 const eligible=enrollments.filter(e=>e.status==="active"&&e.enrollmentType==="one_to_one"&&e.scheduleRules.length);
 const enrollment=eligible.find(e=>e.id===selected);
 const course=courses.find(c=>c.id===enrollment?.courseId);
 const preview=useMemo(()=>{
  if(!enrollment||!course)return{rows:[],error:""};
  try{return{rows:previewCourseSchedule({startDate:enrollment.startedAt,timezone:enrollment.scheduleTimezone,rules:enrollment.scheduleRules,horizon,totalSessions:enrollment.plannedSessions||course.totalSessions,weeks,trainerId:enrollment.trainerId,learnerId:enrollment.studentId,existingEvents:events}),error:""}}
  catch(e){return{rows:[],error:e instanceof Error?e.message:String(e)};
  }
 },[enrollment,course,horizon,weeks,events]);
 const previouslyBooked=events.filter(e=>e.enrollmentId===selected&&e.eventType==="class");
 async function book(){
  if(!enrollment)return;
  if(preview.error){setError(preview.error);return;}
  if(preview.rows.some(row=>row.conflicts.length)&&!confirm("Some proposed times overlap existing classes. Server validation will block conflicting bookings. Continue?"))return;
  if(!confirm("Create eligible future class bookings for this learner? Existing generated occurrences will not be duplicated."))return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await generateEnrollmentScheduleV2(enrollment.id,horizon,horizon==="weeks"?weeks:undefined);
   if(!result.ok){setError(result.error);return;}
   setNotice(result.created+" class bookings created; "+result.total+" generated occurrences accounted for.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function reassign(){
  if(!enrollment||!replacement||!reason.trim())return setError("Choose a replacement trainer and provide a reason.");
  if(!confirm("Transfer eligible future classes to the new trainer? Completed classes and payroll will remain unchanged."))return;
  setBusy(true);setError("");setNotice("");
  try{const result=await reassignEnrollmentTrainerV2(enrollment.id,replacement,reason.trim());if(!result.ok)return setError(result.error);setNotice(result.updated+" future class(es) moved to the replacement trainer.");setReplacement("");setReason("");await refresh()}
  catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <RoleGuard allow={["admin"]}><AppShell role="admin">
  <AdminPageHeader eyebrow="SCHEDULING V2" title="Generate Course Classes" description="Create dated 1-to-1 classes from the enrollment timetable. Review conflicts before booking; individual cohort sessions are managed separately." actions={<Link href="/admin/enrollments" className="button ghost">Back to Enrollments</Link>}/>
  <section className="panel">
   <div className="formGrid">
    <div className="formGroup"><label>Active individual enrollment</label><select className="input" value={selected} onChange={e=>{setSelected(e.target.value);setNotice("");setError("")}}><option value="">Choose a learner</option>{eligible.map(e=><option key={e.id} value={e.id}>{students.find(s=>s.id===e.studentId)?.fullName||"Student"} · {courses.find(c=>c.id===e.courseId)?.title||"Course"}</option>)}</select></div>
    <div className="formGroup"><label>Generate for</label><select className="input" value={horizon} onChange={e=>setHorizon(e.target.value as SchedulingHorizon)}><option value="full">Entire course</option><option value="weeks">Selected weeks</option><option value="manual">Manual (do not generate)</option></select></div>
    {horizon==="weeks"&&<div className="formGroup"><label>Weeks</label><input className="input" type="number" min={1} max={104} value={weeks} onChange={e=>setWeeks(Number(e.target.value))}/></div>}
   </div>
   {enrollment&&<div className="infoBanner">Course: {course?.title||"—"} · {(enrollment.plannedSessions||course?.totalSessions||0)} agreed sessions · {previouslyBooked.length} existing class records. Existing cancellations and modified classes remain recorded.</div>}
   {preview.error&&<div className="errorBanner">{preview.error}</div>}
   {error&&<div className="errorBanner">{error}</div>}
   {notice&&<div className="successBanner">{notice}</div>}
   {enrollment&&!preview.error&&<><p className="fieldHint">{preview.rows.length} proposed dates · {preview.rows.filter(x=>x.conflicts.length).length} overlapping-date warning(s). Database checks are authoritative.</p>
   <div className="tableWrap" style={{maxHeight:360,overflow:"auto"}}><table><thead><tr><th>Date</th><th>Local time</th><th>Conflict</th></tr></thead><tbody>{preview.rows.map((slot,i)=><tr key={i}><td>{slot.date}</td><td>{slot.startTime}–{slot.endTime}</td><td>{slot.conflicts.join(", ")||"—"}</td></tr>)}</tbody></table></div></>}
   <div className="formActions"><button className="button" disabled={busy||!enrollment||!!preview.error||horizon==="manual"} onClick={book}>{busy?"Booking…":"Generate class bookings"}</button></div>
  </section>
  {enrollment&&<EnrollmentPauseControls key={enrollment.id} enrollmentId={enrollment.id} status={enrollment.status} role="admin" onChanged={refresh}/>}
  {enrollment&&<section className="panel" style={{marginTop:16}}>
   <div className="panelHeader"><div><h2>Replace trainer</h2><p>Moves only eligible future 1-to-1 classes. Completed classes and approved/paid earnings remain with the original trainer.</p></div></div>
   <div className="formGrid">
    <div className="formGroup"><label>Replacement trainer</label><select className="input" value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">Choose a trainer</option>{trainers.filter(t=>t.id!==enrollment.trainerId&&t.recordStatus==="active"&&t.courseIds.includes(enrollment.courseId)).map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select></div>
    <div className="formGroup"><label>Reason for change</label><input className="input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Trainer is leaving the program"/></div>
   </div>
   <div className="formActions"><button className="button" disabled={busy||!replacement||!reason.trim()} onClick={reassign}>Change trainer for future classes</button></div>
  </section>}
  <div className="infoBanner">Class generation is atomic for an individual enrollment. If an availability conflict occurs, no partial set is committed. Trainer/learner holds, payroll locks, Zoom provisioning and cohort operations remain separately controlled.</div>
 </AppShell></RoleGuard>;
}
