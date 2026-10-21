"use client";
import {useState} from "react";
import {pauseEnrollmentV2,resumeEnrollmentV2} from "@/lib/repository";
import {todayIstDate} from "@/lib/ist-date";
import type {EnrollmentStatus} from "@/lib/types";
type HoldReason="exams"|"medical"|"travel"|"family"|"other";

export function EnrollmentPauseControls({enrollmentId,status,role,onChanged}:{enrollmentId:string;status:EnrollmentStatus;role:"trainer"|"admin";onChanged:()=>Promise<void>}){
 const[from,setFrom]=useState(todayIstDate());
 const[resume,setResume]=useState("");
 const[reason,setReason]=useState<HoldReason>("exams");
 const[note,setNote]=useState("");
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 const[error,setError]=useState("");
 async function pause(){
  setBusy(true);setError("");setMessage("");
  try{
   if(!resume||resume<=from){setError("Choose a resume date after the break begins.");return;}
   if(!confirm("Pause this learner and shift eligible future classes? If any class or Zoom meeting needs manual review, the operation will be rejected without partial changes."))return;
   const result=await pauseEnrollmentV2(enrollmentId,from,resume,reason,note.trim());
   if(!result.ok){setError(result.error);return;}
   setMessage("Enrollment paused. "+result.moved+" future sessions shifted by "+result.shiftDays+" days.");await onChanged();
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function restore(){
  setBusy(true);setError("");setMessage("");
  try{
   if(!confirm("Resume this enrollment? Previously shifted dates will remain unchanged."))return;
   const result=await resumeEnrollmentV2(enrollmentId,note.trim());
   if(!result.ok){setError(result.error);return;}
   setMessage("Enrollment resumed. The adjusted timetable has been preserved.");await onChanged();
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <section className="panel" style={{marginTop:16}}>
  <div className="panelHeader"><div><div className="eyebrow">CLASS BREAKS</div><h2>{status==="on_hold"?"Resume classes":"Pause for exams or vacation"}</h2><p>{role==="trainer"?"Trainers can approve breaks up to 14 calendar days. Longer breaks need Admin.":"Admin can approve longer breaks when needed."} Existing modified classes and individual Zoom meetings are protected against unsafe shifts.</p></div></div>
  {status==="active"&&<div className="formGrid">
   <div className="formGroup"><label>Reason</label><select className="input" value={reason} onChange={e=>setReason(e.target.value as HoldReason)}><option value="exams">School examinations</option><option value="travel">Vacation / travel</option><option value="medical">Medical</option><option value="family">Family reason</option><option value="other">Other</option></select></div>
   <div className="formGroup"><label>Break from</label><input className="input" type="date" min={todayIstDate()} value={from} onChange={e=>setFrom(e.target.value)}/></div>
   <div className="formGroup"><label>Resume from</label><input className="input" type="date" min={from} value={resume} onChange={e=>setResume(e.target.value)}/></div>
   <div className="formGroup"><label>Note (optional)</label><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Agreed with parent over WhatsApp"/></div>
  </div>}
  {status==="on_hold"&&<div className="formGroup"><label>Resume note (optional)</label><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Returning to normal timetable"/></div>}
  {error&&<div className="errorBanner">{error}</div>}{message&&<div className="successBanner">{message}</div>}
  <div className="formActions">{status==="active"?<button className="button" disabled={busy||!resume} onClick={pause}>{busy?"Saving…":"Pause & shift future classes"}</button>:status==="on_hold"?<button className="button" disabled={busy} onClick={restore}>{busy?"Resuming…":"Resume enrollment"}</button>:<small className="fieldHint">Only active or paused enrollments can be changed.</small>}</div>
 </section>;
}
