"use client";
import Link from "next/link";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";
import {useCallback,useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {KpiCard} from "@/components/admin/KpiCard";
import {Pagination} from "@/components/admin/Pagination";
import {listAdminEnrollments,listAdminStudents,listAdminTrainers,listScheduleEvents} from "@/lib/repository";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import type {EnrollmentAdminRecord,ScheduleEvent,StudentAdminRecord,TrainerAdminRecord} from "@/lib/types";
type Priority="high"|"medium"|"low";
type Alert={key:string;type:string;category:string;priority:Priority;title:string;detail:string;href:string;lastSeen?:string;count?:number};
type State={alert_key:string;status:string;note:string;assigned_to:string|null;snoozed_until:string|null};
type Admin={id:string;full_name:string};
const weight={high:0,medium:1,low:2};
const format=(s:string)=>new Date(s).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
const encode=(...parts:string[])=>parts.map(encodeURIComponent).join("|");
export default function OperationalAlerts(){
 const[enrollments,setEnrollments]=useState<EnrollmentAdminRecord[]>([]),[students,setStudents]=useState<StudentAdminRecord[]>([]),[trainers,setTrainers]=useState<TrainerAdminRecord[]>([]),[events,setEvents]=useState<ScheduleEvent[]>([]);
 const[system,setSystem]=useState<Alert[]>([]),[states,setStates]=useState<State[]>([]),[admins,setAdmins]=useState<Admin[]>([]);
 const[loading,setLoading]=useState(true),[partialError,setPartialError]=useState(""),[error,setError]=useState(""),[updated,setUpdated]=useState(""),[statesAvailable,setStatesAvailable]=useState(false),[truncated,setTruncated]=useState(false);
 const[q,setQ]=useState(""),[priority,setPriority]=useState("all"),[category,setCategory]=useState("all"),[statusFilter,setStatusFilter]=useState("active"),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[selected,setSelected]=useState("");
 const[editStatus,setEditStatus]=useState("open"),[note,setNote]=useState(""),[assignedTo,setAssignedTo]=useState(""),[snooze,setSnooze]=useState("0"),[saving,setSaving]=useState(false);
 const reload=useCallback(async()=>{
  setLoading(true);setError("");setPartialError("");
  try{
   const supabase=getSupabaseBrowserClient();
   const session=supabase?(await supabase.auth.getSession()).data.session:null;
   if(!session)throw new Error("Administrator login required.");
   const [dataResult,systemResult]=await Promise.allSettled([
    Promise.all([listAdminEnrollments(),listAdminStudents(),listAdminTrainers(),listScheduleEvents()]),
    fetch("/api/admin/operational-alerts",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||"Monitoring unavailable");return body;})
   ]);
   if(dataResult.status==="fulfilled"){const [e,s,t,ev]=dataResult.value;setEnrollments(e);setStudents(s);setTrainers(t);setEvents(ev);}
   else setPartialError("Business alert checks could not complete.");
   if(systemResult.status==="fulfilled"){const x=systemResult.value;setSystem(x.alerts||[]);setStates(x.states||[]);setAdmins(x.admins||[]);setStatesAvailable(Boolean(x.statesAvailable));setTruncated(Boolean(x.truncated));setUpdated(x.monitoredAt);}
   else setPartialError(v=>v+" Zoom and system alert checks could not complete.");
   if(dataResult.status==="rejected"&&systemResult.status==="rejected")setError("Unable to refresh operational alerts. Do not assume zero alerts.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load alerts");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void reload()},[reload]);
 useLiveRefresh(["enrollments","students","trainers","schedule_events","progress_alert_actions"],reload,"admin-alerts");
 const today=new Date().toISOString().slice(0,10);
 const alerts=useMemo<Alert[]>(()=>{
  const items:Alert[]=[...system];
  const name=(id:string)=>students.find(s=>s.id===id)?.fullName||"Learner";
  const trainer=(id:string)=>trainers.find(t=>t.id===id)?.fullName||"Trainer";
  for(const e of enrollments.filter(x=>x.status==="on_hold"))items.push({key:encode("hold",e.id),type:"Enrollment hold",category:"Learners",priority:"medium",title:name(e.studentId)+" · enrollment on hold",detail:e.holdReason?e.holdReason.replaceAll("_"," "):"Review hold and next steps",href:"/admin/enrollments"});
  for(const e of events.filter(x=>x.eventType==="class"&&x.date<today&&x.status==="scheduled"))items.push({key:encode("class",e.id),type:"Class record",category:"Classes",priority:"high",title:"Class outcome pending · "+e.title,detail:e.date+" · "+e.startTime+" · "+trainer(e.trainerId),href:"/admin/classes/"+encodeURIComponent(e.id)});
  for(const t of trainers.filter(x=>x.recordStatus==="active"&&!x.loginLinked))items.push({key:encode("login",t.id),type:"Trainer access",category:"Trainers",priority:"low",title:"Account not linked · "+t.fullName,detail:"Connect the trainer login before online classes.",href:"/admin/trainers/"+encodeURIComponent(t.id)});
  return items;
 },[system,enrollments,students,trainers,events,today]);
 const now=Date.now();
 const stateOf=(a:Alert)=>states.find(s=>s.alert_key===a.key);
 const visible=alerts.filter(a=>{
  const st=stateOf(a);const snoozed=!!st?.snoozed_until&&new Date(st.snoozed_until).getTime()>now;
  // High-priority recurring technical problems must remain visible despite acknowledgements or snoozes.
  const active=(!snoozed||a.priority==="high")&&(st?.status!=="resolved"||a.priority==="high");
  return (statusFilter==="all"||(statusFilter==="active"?active:statusFilter==="snoozed"?snoozed:st?.status===statusFilter))
    &&(category==="all"||a.category===category)&&(priority==="all"||a.priority===priority)
    &&[a.title,a.detail,a.type].join(" ").toLowerCase().includes(q.toLowerCase());
 }).sort((a,b)=>weight[a.priority]-weight[b.priority]||(b.lastSeen||"").localeCompare(a.lastSeen||"")||a.title.localeCompare(b.title));
 const paged=visible.slice((page-1)*pageSize,page*pageSize);
 const selectedAlert=alerts.find(x=>x.key===selected);
 function choose(a:Alert){setSelected(a.key);const s=stateOf(a);setEditStatus(s?.status||"open");setNote(s?.note||"");setAssignedTo(s?.assigned_to||"");setSnooze("0");}
 async function save(){
  if(!selectedAlert)return;setSaving(true);setError("");
  try{const client=getSupabaseBrowserClient(),session=client?(await client.auth.getSession()).data.session:null;if(!session)throw Error("Sign in again.");
   const res=await fetch("/api/admin/operational-alerts",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({key:selectedAlert.key,status:editStatus,note,assignedTo,snoozeHours:Number(snooze)})});
   const body=await res.json();if(!res.ok)throw Error(body.error||"Unable to save");
   await reload();setSelected("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save alert");}finally{setSaving(false);}
 }
 const openCount=alerts.filter(a=>{const s=stateOf(a);return a.priority==="high"||(!["resolved"].includes(s?.status||"")&&(!s?.snoozed_until||new Date(s.snoozed_until).getTime()<=now))}).length;
 const highCount=alerts.filter(a=>a.priority==="high").length;
 return <RoleGuard allow={["admin"]}><AppShell role="admin"><AdminPageHeader eyebrow="OPERATIONS" title="Operational Alerts" description="An action queue for delivery, learners, trainers and monitored technical issues. Event history stays in System Logs." actions={<button className="button ghost" disabled={loading} onClick={()=>void reload()}>{loading?"Checking…":"Refresh"}</button>}/>
 <section className="dashboardKpis"><KpiCard label="Requires attention" value={loading&&!updated?"—":openCount} detail="Active monitored items" tone="amber"/><KpiCard label="High priority" value={loading&&!updated?"—":highCount} detail="Always shown while condition persists" tone="rose"/><KpiCard label="Enrollment holds" value={enrollments.filter(e=>e.status==="on_hold").length} detail="Paused learner enrollments" tone="teal"/><KpiCard label="Trainer access" value={trainers.filter(t=>t.recordStatus==="active"&&!t.loginLinked).length} detail="Active trainer login missing" tone="slate"/></section>
 <p className="fieldHint">Last checked: {updated?format(updated):"Not checked yet"} · Monitors: classes, enrollment holds, trainer access, Zoom/System errors and scheduled jobs. Other business processes are not yet covered.</p>
 {error&&<div role="alert" className="errorBanner">{error}</div>}{partialError&&<div role="alert" className="errorBanner">Partial monitoring: {partialError} Counts may be incomplete.</div>}{truncated&&<div className="infoBanner">Technical alerts use the latest 2,000 error events in 24 hours; counts may be incomplete.</div>}
 {!statesAvailable&&!loading&&<div className="infoBanner">Acknowledgements and snoozes are unavailable until the operational alert state migration is installed.</div>}
 <section className="dataSection"><div className="dataToolbar" style={{flexWrap:"wrap",gap:8}}><div className="toolbarSearch"><input className="input" value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search operational alerts…"/></div><select className="input compactInput" value={priority} onChange={e=>{setPriority(e.target.value);setPage(1)}}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select className="input compactInput" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="all">All categories</option>{["Classes","Learners","Trainers","Finance","Zoom","System"].map(c=><option key={c} value={c}>{c}</option>)}</select><select className="input compactInput" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option value="active">Active</option><option value="all">All</option><option value="acknowledged">Acknowledged</option><option value="snoozed">Snoozed</option><option value="resolved">Resolved</option></select></div>
 <div className="tableWrap professionalTable"><table><thead><tr><th>Priority</th><th>Category</th><th>Issue</th><th>Details / last seen</th><th>Action</th></tr></thead><tbody>{paged.map(a=><tr key={a.key}><td><span className={`statusBadge status-${a.priority}`}>{a.priority}</span></td><td>{a.category}</td><td><b>{a.title}</b>{a.count&&a.count>1?<div className="cellSub">{a.count} occurrences in 24h</div>:null}<div className="cellSub">{stateOf(a)?.status||"open"}</div></td><td>{a.detail}{a.lastSeen&&<div className="cellSub">Last seen {format(a.lastSeen)}</div>}</td><td><Link className="tableAction" href={a.href}>Investigate</Link> <button className="button ghost smallButton" onClick={()=>choose(a)} disabled={!statesAvailable}>Manage</button></td></tr>)}
 {!paged.length&&!loading&&!error&&!partialError&&<tr><td colSpan={5}><div className="emptyState compact">No active alerts in the monitored categories. This does not confirm all systems are healthy.</div></td></tr>}
 {!paged.length&&loading&&<tr><td colSpan={5}>Checking operational conditions…</td></tr>}</tbody></table></div>
 <Pagination page={page} total={visible.length} pageSize={pageSize} onPage={setPage} onPageSizeChange={v=>{setPageSize(v);setPage(1)}}/>
 {selectedAlert&&<section className="panel" style={{marginTop:12,padding:16}}><div className="panelHeader"><div><h3>Manage follow-up</h3><p>{selectedAlert.title}</p></div><button className="button ghost" onClick={()=>setSelected("")}>Close</button></div>
 <p className="fieldHint">Acknowledgement or resolution is administrative tracking only. Recurring high-priority problems remain visible until the underlying condition clears.</p>
 <div className="formGrid"><label>Status<select className="input" value={editStatus} onChange={e=>setEditStatus(e.target.value)}><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select></label><label>Assigned admin<select className="input" value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}><option value="">Unassigned</option>{admins.map(a=><option key={a.id} value={a.id}>{a.full_name||"Admin"}</option>)}</select></label><label>Snooze<select className="input" value={snooze} onChange={e=>setSnooze(e.target.value)}><option value="0">No snooze</option><option value="1">1 hour</option><option value="4">4 hours</option><option value="24">24 hours</option></select></label><label>Internal follow-up note<input className="input" maxLength={500} placeholder="Do not enter student or security secrets" value={note} onChange={e=>setNote(e.target.value)}/></label></div><button className="button secondary" disabled={saving} onClick={()=>void save()}>{saving?"Saving…":"Save follow-up"}</button></section>}
 </section></AppShell></RoleGuard>;
}
