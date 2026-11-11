"use client";
import {useEffect,useMemo,useState} from "react";
import {connectFetch,crmCommand,type ConnectAppointment,type ConnectPerson,type ConnectOpportunity,type ConnectProgram,type ConnectMember} from "@/features/connect/api/client";
import {ConnectAppointmentEditor} from "./ConnectAppointmentEditor";
import {ConnectPortalDemos} from "./ConnectPortalDemos";

type View="month"|"week"|"agenda";
type StatusFilter="all"|"scheduled"|"completed"|"cancelled";
type Props={
 tenantId:string;appointments:ConnectAppointment[];people:ConnectPerson[];opportunities:ConnectOpportunity[];
 programs:ConnectProgram[];members:ConnectMember[];canWrite:boolean;canManage:boolean;
 onChanged:()=>void;onOpenContact:(id:string)=>void;onOpenOpportunity:(id:string)=>void;
};
const TZ="Asia/Kolkata";
function parts(value:Date){
 const values=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
 const get=(type:string)=>values.find(p=>p.type===type)?.value||"";
 return get("year")+"-"+get("month")+"-"+get("day");
}
function dateUTC(key:string){return new Date(key+"T00:00:00Z");}
function shiftDay(key:string,n:number){return new Date(dateUTC(key).getTime()+n*86400000).toISOString().slice(0,10);}
function weekStart(key:string){const day=dateUTC(key).getUTCDay();return shiftDay(key,-((day+6)%7));}
function monthStart(key:string){return key.slice(0,7)+"-01";}
function moveMonth(key:string,delta:number){const d=dateUTC(monthStart(key));d.setUTCMonth(d.getUTCMonth()+delta);return d.toISOString().slice(0,10);}
function niceDay(key:string,options:Intl.DateTimeFormatOptions={day:"numeric",month:"short"}){return dateUTC(key).toLocaleDateString("en-IN",{...options,timeZone:"UTC"});}
function atTime(iso:string){return new Date(iso).toLocaleTimeString("en-IN",{timeZone:TZ,hour:"numeric",minute:"2-digit"});}
function titleCase(s:string){return s.replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function appointmentStatus(a:ConnectAppointment):StatusFilter{return a.status==="scheduled"?"scheduled":a.status==="completed"?"completed":"cancelled";}
export function ConnectCalendar({tenantId,appointments,people,opportunities,programs,members,canWrite,canManage,onChanged,onOpenContact,onOpenOpportunity}:Props){
 const [view,setView]=useState<View>("month");
 const [selectedDay,setSelectedDay]=useState(()=>parts(new Date()));
 const [anchor,setAnchor]=useState(()=>parts(new Date()));
 const [status,setStatus]=useState<StatusFilter>("all");
 const [activeId,setActiveId]=useState<string|null>(null);
 const [editor,setEditor]=useState<{appointment:ConnectAppointment|null;day:string}|null>(null);
 const [followupId,setFollowupId]=useState<string|null>(null);
 const [followupTitle,setFollowupTitle]=useState("");
 const [followupDate,setFollowupDate]=useState("");
 const [submitting,setSubmitting]=useState(false);
 const [actionError,setActionError]=useState("");
 const [actionNotice,setActionNotice]=useState("");
 const [assignees,setAssignees]=useState<Array<{id:string;label:string;role:string}>>([]);
 useEffect(()=>{let active=true;void connectFetch<{assignees:Array<{id:string;label:string;role:string}>}>("/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/assignees")
  .then(r=>{if(active)setAssignees(r.assignees||[]);}).catch(()=>{});return()=>{active=false;};},[tenantId]);
 const today=parts(new Date());
 const visible=useMemo(()=>appointments.filter(a=>status==="all"||appointmentStatus(a)===status).slice().sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)),[appointments,status]);
 const byDay=useMemo(()=>{const map=new Map<string,ConnectAppointment[]>();for(const item of visible){const key=parts(new Date(item.starts_at));const list=map.get(key)||[];list.push(item);map.set(key,list);}return map;},[visible]);
 const nameById=useMemo(()=>new Map(people.map(p=>[p.id,p.full_name])),[people]);
 const start=view==="week"?weekStart(anchor):weekStart(monthStart(anchor));
 const count=view==="week"?7:(()=>{
  const last=moveMonth(anchor,1);const monthEnd=shiftDay(last,-1);
  return Math.ceil((Math.round((dateUTC(monthEnd).getTime()-dateUTC(start).getTime())/86400000)+1)/7)*7;
 })();
 const days=Array.from({length:count},(_,i)=>shiftDay(start,i));
 const selected=byDay.get(selectedDay)||[];
 const totalScheduled=appointments.filter(a=>a.status==="scheduled").length;
 const totalCompleted=appointments.filter(a=>a.status==="completed").length;
 const totalCancelled=appointments.filter(a=>a.status==="cancelled").length;
 const setDate=(day:string)=>{setSelectedDay(day);setAnchor(day);setActiveId(null);};
 const navigate=(delta:number)=>{setAnchor(old=>view==="week"?shiftDay(old,delta*7):moveMonth(old,delta));setActiveId(null);};
 const heading=view==="week"?niceDay(start,{day:"numeric",month:"short"})+" – "+niceDay(shiftDay(start,6),{day:"numeric",month:"short",year:"numeric"}):niceDay(monthStart(anchor),{month:"long",year:"numeric"});
 const openCard=(a:ConnectAppointment)=>setActiveId(current=>current===a.id?null:a.id);
 async function changeStatus(a:ConnectAppointment,status:"completed"|"cancelled"){
  if(submitting)return;
  if(status==="cancelled"&&!window.confirm("Cancel this appointment? The customer will not be notified automatically."))return;
  setSubmitting(true);setActionError("");setActionNotice("");
  try{
   await crmCommand(tenantId,"appointments","finish_appointment",{appointmentId:a.id,status});
   setActionNotice(status==="completed"?"Appointment completed.":"Appointment cancelled. No message was sent.");
   onChanged();
  }catch(e){setActionError(e instanceof Error?e.message:"Could not change appointment status.");}
  finally{setSubmitting(false);}
 }
 async function createFollowup(a:ConnectAppointment){
  if(submitting)return;
  if(!followupTitle.trim()||!followupDate){setActionError("Enter a follow-up title and due date.");return;}
  setSubmitting(true);setActionError("");setActionNotice("");
  try{
   await crmCommand(tenantId,"tasks","create_task",{
    title:followupTitle.trim(),personId:a.person_id||undefined,opportunityId:a.opportunity_id||undefined,
    dueAt:new Date(Date.parse(followupDate+":00+05:30")).toISOString()
   });
   setActionNotice("Follow-up task created. View it under Follow-ups.");
   setFollowupId(null);setFollowupTitle("");setFollowupDate("");onChanged();
  }catch(e){setActionError(e instanceof Error?e.message:"Could not create follow-up.");}
  finally{setSubmitting(false);}
 }
 const startFollowup=(a:ConnectAppointment)=>{
  setFollowupId(a.id);
  setFollowupTitle("Follow up after "+a.title.replace(/^\[DEMO\]\s*/,""));
  const d=new Date(Date.parse(a.ends_at)+24*60*60*1000+330*60*1000);
  setFollowupDate(d.toISOString().slice(0,16));
 };
 const eventRow=(a:ConnectAppointment)=><div key={a.id} className="ccal-event-wrap">
  <button type="button" className={"ccal-event "+(activeId===a.id?"is-expanded":"")} onClick={()=>openCard(a)} aria-expanded={activeId===a.id}>
   <span className={"ccal-event-mark "+appointmentStatus(a)}/>
   <span className="ccal-event-info"><strong>{a.title}</strong><small>{atTime(a.starts_at)} – {atTime(a.ends_at)} · {titleCase(a.kind)}{a.person_id&&nameById.get(a.person_id)?" · "+nameById.get(a.person_id):""}</small></span>
   <span className={"ccal-status "+appointmentStatus(a)}>{titleCase(a.status)}</span>
   <span className="ccal-event-arrow" aria-hidden="true">{activeId===a.id?"⌃":"⌄"}</span>
  </button>
  {activeId===a.id&&<div className="ccal-event-details">
   <span>When: {niceDay(parts(new Date(a.starts_at)),{weekday:"long",day:"numeric",month:"short",year:"numeric"})}, {atTime(a.starts_at)} – {atTime(a.ends_at)} IST</span>
   {a.person_id&&nameById.get(a.person_id)&&<span>Customer: {nameById.get(a.person_id)}</span>}
   {a.programme&&<span>Programme: {a.programme}</span>}
   {a.owner_membership_id&&<span>Assigned to: {assignees.find(m=>m.id===a.owner_membership_id)?.label||"Team member"}</span>}
   {a.location&&<span>Location: {a.location}</span>}
   {a.meeting_url&&<span>Meeting: <a href={a.meeting_url} target="_blank" rel="noopener noreferrer">Open meeting link ↗</a></span>}
   {a.notes&&<p className="ccal-appointment-notes">{a.notes}</p>}
   <div className="ccal-event-actions">
    {a.person_id&&<button type="button" className="ccal-action-secondary" onClick={()=>onOpenContact(a.person_id!)}>Open contact</button>}
    {a.opportunity_id&&<button type="button" className="ccal-action-secondary" onClick={()=>onOpenOpportunity(a.opportunity_id!)}>View admission</button>}
    {canWrite&&a.status==="scheduled"&&<>
     <button type="button" className="ccal-action-secondary" disabled={submitting} onClick={()=>setEditor({appointment:a,day:parts(new Date(a.starts_at))})}>Edit / reschedule</button>
     <button type="button" className="ccal-action-primary" disabled={submitting} onClick={()=>void changeStatus(a,"completed")}>Mark completed</button>
     <button type="button" className="ccal-action-danger" disabled={submitting} onClick={()=>void changeStatus(a,"cancelled")}>Cancel appointment</button>
    </>}
    {canWrite&&(a.person_id||a.opportunity_id)&&<button type="button" className="ccal-action-secondary" onClick={()=>followupId===a.id?setFollowupId(null):startFollowup(a)}>{followupId===a.id?"Close follow-up":"Create follow-up"}</button>}
   </div>
   {canWrite&&followupId===a.id&&<form className="ccal-followup-form" onSubmit={e=>{e.preventDefault();void createFollowup(a);}}>
     <label>Follow-up task<input maxLength={250} required value={followupTitle} onChange={e=>setFollowupTitle(e.target.value)}/></label>
     <label>Due (IST)<input type="datetime-local" required value={followupDate} onChange={e=>setFollowupDate(e.target.value)}/></label>
     <button type="submit" className="ccal-action-primary" disabled={submitting}>Create task</button>
   </form>}
  </div>}
 </div>;
 return <section className="ccal" aria-label="Counselling and trial calendar">
  <ConnectPortalDemos tenantId={tenantId} people={people} opportunities={opportunities} canWrite={canWrite} canManage={canManage}/>
  <div className="ccal-heading"><div><h2>Appointments calendar</h2><p>See counselling, demos, trials and meetings at a glance</p></div><div className="ccal-heading-actions">{canWrite&&<button type="button" className="ccal-new-button" onClick={()=>setEditor({appointment:null,day:selectedDay})}>＋ New appointment</button>}<div className="ccal-view" role="group" aria-label="Calendar view">{(["month","week","agenda"] as View[]).map(v=><button type="button" key={v} aria-pressed={view===v} className={view===v?"active":""} onClick={()=>{setView(v);setActiveId(null);}}>{v==="agenda"?"List":titleCase(v)}</button>)}</div></div></div>
  {actionError&&<div className="ccal-banner-error" role="alert">{actionError}</div>}
  {actionNotice&&<div className="ccal-banner-notice" role="status">{actionNotice}</div>}
  <div className="ccal-summary"><span><strong>{appointments.length}</strong> Total</span><span><i className="ccal-dot scheduled"/><strong>{totalScheduled}</strong> Scheduled</span><span><i className="ccal-dot completed"/><strong>{totalCompleted}</strong> Completed</span><span><i className="ccal-dot cancelled"/><strong>{totalCancelled}</strong> Cancelled</span></div>
  <div className="ccal-toolbar"><div className="ccal-period"><button type="button" aria-label="Previous period" onClick={()=>navigate(-1)} disabled={view==="agenda"}>‹</button><strong>{view==="agenda"?"All appointments":heading}</strong><button type="button" aria-label="Next period" onClick={()=>navigate(1)} disabled={view==="agenda"}>›</button><button type="button" className="ccal-today" onClick={()=>setDate(today)}>Today</button></div>
   <label className="ccal-filter-label">Status <select aria-label="Filter appointments by status" value={status} onChange={e=>{setStatus(e.target.value as StatusFilter);setActiveId(null);}}><option value="all">All appointments</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label></div>
  {view==="agenda"?<div className="ccal-agenda">
   <div className="ccal-agenda-label">{visible.length} appointment{visible.length===1?"":"s"} · Date order</div>
   {visible.length?visible.map(a=><div key={a.id} className="ccal-agenda-group"><time>{niceDay(parts(new Date(a.starts_at)),{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</time>{eventRow(a)}</div>):<div className="ccal-empty">No matching appointments. Open a contact to schedule a demo or counselling session.</div>}
  </div>:<>
   <div className="ccal-weekdays" aria-hidden="true">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><span key={day}>{day}</span>)}</div>
   <div className={"ccal-grid "+(view==="week"?"ccal-grid-week":"")}>
    {days.map(day=>{const items=byDay.get(day)||[];const inMonth=day.slice(0,7)===anchor.slice(0,7);return <button type="button" key={day} className={"ccal-cell "+(!inMonth&&view==="month"?"is-outside ":"")+(day===today?"is-today ":"")+(day===selectedDay?"is-selected":"")} aria-pressed={day===selectedDay} onClick={()=>{setSelectedDay(day);setActiveId(null);}}>
     <span className="ccal-day-number">{Number(day.slice(8))}</span><span className="ccal-day-items">{items.slice(0,view==="week"?4:2).map(item=><span key={item.id} className={"ccal-day-item "+appointmentStatus(item)} title={item.title}><b>{atTime(item.starts_at)}</b> {item.title.replace(/^\[DEMO\]\s*/,"")}</span>)}{items.length>(view==="week"?4:2)&&<small>+{items.length-(view==="week"?4:2)} more</small>}</span>
     {items.length===0&&<span className="ccal-day-blank" aria-hidden="true"/>}
    </button>;})}
   </div>
   <div className="ccal-selected"><div className="ccal-selected-head"><h3>{niceDay(selectedDay,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</h3><span>{selected.length} appointment{selected.length===1?"":"s"}</span>{canWrite&&<button type="button" className="ccal-small-add" onClick={()=>setEditor({appointment:null,day:selectedDay})}>＋ Add on this date</button>}</div>
    {selected.length?<div className="ccal-selected-events">{selected.map(a=>eventRow(a))}</div>:<p className="ccal-no-day">No appointments on this day. Select a highlighted date to view its sessions.</p>}
   </div>
  </>}
  <footer className="ccal-footer"><span className="ccal-dot scheduled"/> Scheduled <span className="ccal-dot completed"/> Completed <span className="ccal-dot cancelled"/> Cancelled <span className="ccal-timezone">All times in India Standard Time (IST)</span></footer>
  {editor&&<ConnectAppointmentEditor key={editor.appointment?.id||editor.day} tenantId={tenantId} appointment={editor.appointment} day={editor.day} people={people} opportunities={opportunities} programs={programs} members={members} canManage={canManage} onClose={()=>setEditor(null)} onSaved={()=>{setActionError("");setActionNotice(editor.appointment?"Appointment updated.":"Appointment created.");onChanged();}}/>}
 </section>;
}
