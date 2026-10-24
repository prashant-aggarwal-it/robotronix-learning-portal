"use client";
import {useEffect,useMemo,useState} from "react";
import {usePathname} from "next/navigation";
import {listPortalAuditLogForRecord,listPortalAuditLog,listLearnerJourneyAudit,resolveAuditActorNames} from "@/lib/repository";
import type {PortalAuditRecord} from "@/lib/types";
import {safeAuditChanges} from "@/lib/audit-display";

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
const changes=(entry:PortalAuditRecord)=>safeAuditChanges(entry.beforeData,entry.afterData);
function printable(v:unknown){if(v===undefined||v===null||v==="")return "—";const s=typeof v==="object"?JSON.stringify(v):String(v);return s.length>180?s.slice(0,180)+"…":s;}
function timestamp(d:string){return new Date(d).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})+" IST";}
export function AdminRecordHistory(){
 const pathname=usePathname();
 const section=pathname.split("/")[2]??"";
 const recordId=pathname.split("/")[3];
 const types=supported[section]??[];
 const hasRecord=Boolean(recordId&&/^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(recordId));
 const eligible=types.length>0;
 const[open,setOpen]=useState(false);
 const[events,setEvents]=useState<PortalAuditRecord[]>([]);
 const[loading,setLoading]=useState(false);
 const[actorNames,setActorNames]=useState<Record<string,string>>({});
 const[search,setSearch]=useState("");
 const[journey,setJourney]=useState(false);
 const[error,setError]=useState("");
 useEffect(()=>{setOpen(false);setEvents([]);setJourney(false);setActorNames({});setSearch("")},[pathname]);
 async function load(includeJourney=journey){setLoading(true);setError("");try{const entries=includeJourney&&section==="students"&&hasRecord?await listLearnerJourneyAudit(recordId,500):hasRecord?await listPortalAuditLogForRecord(types,recordId,500):(await listPortalAuditLog(2000)).filter(e=>types.includes(e.entityType));setEvents(entries);setActorNames(await resolveAuditActorNames(entries.map(e=>e.actorProfileId??"")))}catch(e){setError(e instanceof Error?e.message:"Unable to load history")}finally{setLoading(false)}}
 const ordered=useMemo(()=>events.filter(e=>[e.entityId,e.entityType,e.action,actorNames[e.actorProfileId??""]??""].join(" ").toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[events,search,actorNames]);
 if(!eligible||section==="audit")return null;
 return <><button type="button" className="button ghost" style={{position:"fixed",right:22,bottom:90,zIndex:40,boxShadow:"0 3px 14px #0002"}} onClick={()=>{setOpen(x=>!x);if(!open)void load(false)}} aria-expanded={open} aria-controls="admin-record-history">↺ {hasRecord?"View history":"Module activity"}</button>
 {open&&<div id="admin-record-history" role="dialog" aria-modal="false" aria-label="Record change history" style={{position:"fixed",right:16,top:100,bottom:150,width:"min(520px,calc(100vw - 32px))",zIndex:45,background:"var(--surface,#fff)",color:"var(--text,#18243c)",border:"1px solid #cbd5e1",borderRadius:16,boxShadow:"0 12px 42px #0003",padding:20,overflowY:"auto"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><h2 style={{margin:0}}>Record history</h2><button className="button ghost" onClick={()=>setOpen(false)} aria-label="Close history">Close</button></div>
  <p style={{overflowWrap:"anywhere",fontSize:13}}>{hasRecord?`Showing history for ${recordId}.`:`Showing recent ${section} activity (up to 2,000 global events).`} Times are displayed in IST. Sensitive fields are hidden.</p>
  {hasRecord&&section==="students"&&<label style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}><input type="checkbox" checked={journey} onChange={e=>{const value=e.target.checked;setJourney(value);void load(value)}}/> Include learner journey (onboarding, enrollments, classes and progress)</label>}
  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter by record, action or actor…" aria-label="Filter history events"/><button className="button ghost" disabled={loading} onClick={()=>void load()}>Refresh</button></div>
  {error&&<div role="alert" className="errorBanner">{error}</div>}
  {loading?<p>Loading history…</p>:ordered.length?ordered.map(e=><article key={e.id} style={{padding:"14px 0",borderBottom:"1px solid #dbe3f0"}}><b>{e.action.toUpperCase()} · {e.entityType.replaceAll("_"," ")}</b><div style={{fontSize:12,opacity:.8}}>{timestamp(e.createdAt)} · {e.actorProfileId?(actorNames[e.actorProfileId]||e.actorProfileId):"System / unknown actor"}</div>
  {changes(e).length?<ul style={{paddingLeft:20}}>{changes(e).map(c=><li key={c.name}><b>{c.name}</b>: {printable(c.from)} → {printable(c.to)}</li>)}</ul>:<p style={{fontSize:13}}>No displayable field changes (or fields are restricted).</p>}</article>):<p>No matching events in the loaded history. This does not prove that earlier events never occurred.</p>}
 </div>}</>;
}
