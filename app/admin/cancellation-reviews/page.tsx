"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {listScheduleEvents,listAdminStudents,listAdminTrainers,resolveClassCancellationV2} from "@/lib/repository";
import type {ScheduleEvent,StudentAdminRecord,TrainerAdminRecord} from "@/lib/types";

export default function CancellationReviews(){
 const[events,setEvents]=useState<ScheduleEvent[]>([]);
 const[students,setStudents]=useState<StudentAdminRecord[]>([]);
 const[trainers,setTrainers]=useState<TrainerAdminRecord[]>([]);
 const[notes,setNotes]=useState<Record<string,string>>({});
 const[busy,setBusy]=useState("");
 const[notice,setNotice]=useState("");
 async function refresh(){
  const [e,s,t]=await Promise.all([listScheduleEvents(),listAdminStudents(),listAdminTrainers()]);
  setEvents(e);setStudents(s);setTrainers(t);
 }
 useEffect(()=>{void refresh().catch(e=>setNotice(e instanceof Error?e.message:String(e)))},[]);
 const pending=events.filter(e=>e.eventType==="class"&&e.status==="cancelled"&&e.financeExceptionStatus==="review");
 async function decide(id:string,decision:"approved"|"rejected"){
  const note=notes[id]?.trim();
  if(!note)return setNotice("Please enter the reason for the financial decision.");
  if(!confirm(decision==="approved"?"Approve the cancellation compensation exception using this trainer's existing pay policy?":"Reject compensation for this cancellation?"))return;
  setBusy(id);setNotice("");
  try{
   const result=await resolveClassCancellationV2(id,decision,note);
   if(!result.ok){setNotice(result.error);return;}
   setNotice("Cancellation review "+decision+".");
   await refresh();
  }catch(e){setNotice(e instanceof Error?e.message:String(e))}
  finally{setBusy("")}
 }
 return <RoleGuard allow={["admin"]}><AppShell role="admin">
  <AdminPageHeader eyebrow="FINANCE EXCEPTIONS" title="Cancellation Reviews" description="Parent-requested cancellations are not automatically deducted or paid. Admin decides whether a trainer compensation exception applies." actions={<Link className="button ghost" href="/admin/classes">Back to Classes</Link>}/>
  {notice&&<div className="infoBanner">{notice}</div>}
  <section className="panel">
   <div className="panelHeader"><div><h2>{pending.length} pending review{pending.length===1?"":"s"}</h2><p>Only Admin can approve compensation. Parent package hours remain unchanged unless a separate fee adjustment is expressly authorized.</p></div></div>
   {pending.length?pending.map(e=><div key={e.id} className="panel" style={{marginBottom:12}}>
    <b>{e.title}</b><p className="fieldHint">{e.date} · {e.startTime}–{e.endTime} {e.timezone} · {students.find(s=>s.id===e.studentId)?.fullName||"Learner"} · {trainers.find(t=>t.id===e.trainerId)?.fullName||"Trainer"}</p>
    <p>Cancellation reason: {e.changeReason||"Not recorded"}</p>
    <div className="formGroup"><label>Admin decision reason *</label><input className="input" value={notes[e.id]||""} onChange={x=>setNotes(v=>({...v,[e.id]:x.target.value}))} placeholder="Review circumstances and compensation policy"/></div>
    <div className="formActions"><button className="button ghost" disabled={busy===e.id} onClick={()=>decide(e.id,"rejected")}>Reject compensation</button><button className="button" disabled={busy===e.id} onClick={()=>decide(e.id,"approved")}>Approve exception</button><Link className="button ghost" href={"/admin/classes/"+e.id}>View class</Link></div>
   </div>):<div className="emptyState compact">No cancellation reviews awaiting a decision.</div>}
  </section>
 </AppShell></RoleGuard>;
}
