"use client";
import {useEffect,useMemo,useState} from "react";
import {usePathname} from "next/navigation";
import {listPortalAuditLog} from "@/lib/repository";
import type {PortalAuditRecord} from "@/lib/types";

const supported:Record<string,string[]>={
 onboarding:["onboarding_submissions"],enrollments:["enrollments","enrollment_holds"],
 classes:["schedule_events","class_attendance"],schedule:["schedule_events"],
 students:["students","student_guardians","parent_students"],trainers:["trainers","trainer_availability","trainer_availability_overrides","trainer_courses"],
 courses:["courses"],cohorts:["cohorts"],
 finance:["student_fee_packages","student_fee_payments","trainer_earnings","trainer_payouts"],
 "trainer-finance":["trainer_earnings","trainer_payouts","trainer_finance","trainer_compensation_plans"],
 progress:["learning_observations","learning_observation_internal_notes","learner_projects"],
 zoom:["zoom_meetings","zoom_recordings"],invoices:["student_invoices"]
};
const sensitive=/password|token|secret|authorization|api_key|bank|account_number|ifsc|pan|phone|mobile|email|address|dob|birth|razorpay_payload|razorpay_response/i;
function changes(entry:PortalAuditRecord){
 const old=(entry.beforeData??{}) as Record<string,unknown>,next=(entry.afterData??{}) as Record<string,unknown>;
 const keys=Array.from(new Set([...Object.keys(old),...Object.keys(next)]));
 return keys.filter(k=>!sensitive.test(k)&&JSON.stringify(old[k])!==JSON.stringify(next[k])).map(k=>({name:k.replaceAll("_"," "),from:old[k],to:next[k]}));
}
function printable(v:unknown){if(v===undefined||v===null||v==="")return "—";const s=typeof v==="object"?JSON.stringify(v):String(v);return s.length>180?s.slice(0,180)+"…":s;}
function timestamp(d:string){return new Date(d).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})+" IST";}
export function AdminRecordHistory(){
 const pathname=usePathname();
 const section=pathname.split("/")[2]??"";
 const recordId=pathname.split("/")[3];
 const types=supported[section]??[];
 const eligible=Boolean(recordId&&/^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(recordId)&&types.length);
 const[open,setOpen]=useState(false);
 const[events,setEvents]=useState<PortalAuditRecord[]>([]);
 const[loading,setLoading]=useState(false);
 const[error,setError]=useState("");
 useEffect(()=>{setOpen(false);setEvents([])},[pathname]);
 async function load(){setLoading(true);setError("");try{setEvents((await listPortalAuditLog(2000)).filter(x=>types.includes(x.entityType)&&x.entityId===recordId))}catch(e){setError(e instanceof Error?e.message:"Unable to load history")}finally{setLoading(false)}}
 const ordered=useMemo(()=>[...events].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[events]);
 if(!eligible||section==="audit")return null;
 return <><button type="button" className="button ghost" style={{position:"fixed",right:22,bottom:90,zIndex:40,boxShadow:"0 3px 14px #0002"}} onClick={()=>{setOpen(x=>!x);if(!open)void load()}} aria-expanded={open} aria-controls="admin-record-history">↺ View history</button>
 {open&&<div id="admin-record-history" role="dialog" aria-modal="false" aria-label="Record change history" style={{position:"fixed",right:16,top:100,bottom:150,width:"min(520px,calc(100vw - 32px))",zIndex:45,background:"var(--surface,#fff)",color:"var(--text,#18243c)",border:"1px solid #cbd5e1",borderRadius:16,boxShadow:"0 12px 42px #0003",padding:20,overflowY:"auto"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><h2 style={{margin:0}}>Record history</h2><button className="button ghost" onClick={()=>setOpen(false)} aria-label="Close history">Close</button></div>
  <p style={{overflowWrap:"anywhere",fontSize:13}}>Showing audit events for {recordId}. Times are displayed in IST. Sensitive fields are hidden.</p>
  <button className="button ghost" disabled={loading} onClick={()=>void load()}>Refresh</button>
  {error&&<div role="alert" className="errorBanner">{error}</div>}
  {loading?<p>Loading history…</p>:ordered.length?ordered.map(e=><article key={e.id} style={{padding:"14px 0",borderBottom:"1px solid #dbe3f0"}}><b>{e.action.toUpperCase()} · {e.entityType.replaceAll("_"," ")}</b><div style={{fontSize:12,opacity:.8}}>{timestamp(e.createdAt)} · {e.actorProfileId||"System / unknown actor"}</div>
  {changes(e).length?<ul style={{paddingLeft:20}}>{changes(e).map(c=><li key={c.name}><b>{c.name}</b>: {printable(c.from)} → {printable(c.to)}</li>)}</ul>:<p style={{fontSize:13}}>No displayable field changes (or fields are restricted).</p>}</article>):<p>No events found for this record in the latest 2,000 events. This is not proof that no previous changes occurred.</p>}
 </div>}</>;
}
