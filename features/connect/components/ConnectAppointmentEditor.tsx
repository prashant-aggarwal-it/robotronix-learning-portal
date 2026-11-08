"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {connectFetch, type ConnectAppointment,type ConnectPerson,type ConnectOpportunity,type ConnectProgram,type ConnectMember} from "@/features/connect/api/client";

type FormData={
 title:string;kind:string;personId:string;opportunityId:string;ownerMemberId:string;
 startsAt:string;endsAt:string;location:string;meetingUrl:string;programme:string;notes:string;
};
const IST_OFFSET=330*60*1000;
function toLocal(value:string){return new Date(Date.parse(value)+IST_OFFSET).toISOString().slice(0,16);}
function fromIST(value:string){return new Date(Date.parse(value+":00+05:30")).toISOString();}
export function ConnectAppointmentEditor({tenantId,appointment,day,people,opportunities,programs,members,canManage,onClose,onSaved}:{
 tenantId:string;appointment:ConnectAppointment|null;day:string;people:ConnectPerson[];opportunities:ConnectOpportunity[];
 programs:ConnectProgram[];members:ConnectMember[];canManage:boolean;onClose:()=>void;onSaved:()=>void;
}){
 const initial=useMemo<FormData>(()=>{
  const date=day+"T11:00",end=day+"T11:45";
  return {title:appointment?.title||"",kind:appointment?.kind||"demo",personId:appointment?.person_id||"",
   opportunityId:appointment?.opportunity_id||"",ownerMemberId:appointment?.owner_membership_id||"",
   startsAt:appointment?toLocal(appointment.starts_at):date,endsAt:appointment?toLocal(appointment.ends_at):end,
   location:appointment?.location||"",meetingUrl:appointment?.meeting_url||"",programme:appointment?.programme||"",notes:appointment?.notes||""};
 },[appointment,day]);
 const [value,setValue]=useState<FormData>(initial);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [staff,setStaff]=useState<Array<{id:string;label:string;role:string}>>([]);
 useEffect(()=>{if(!canManage)return;let active=true;
  void connectFetch<{assignees:Array<{id:string;label:string;role:string}>}>("/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/assignees")
   .then(r=>{if(active)setStaff(r.assignees||[]);}).catch(()=>{});
  return()=>{active=false;};
 },[tenantId,canManage]);
 const set=(name:keyof FormData,v:string)=>setValue(prev=>({...prev,[name]:v}));
 const hasUnsavedChanges=Object.keys(initial).some(key=>value[key as keyof FormData]!==initial[key as keyof FormData]);
 const requestClose=()=>{if(busy)return;if(hasUnsavedChanges&&!window.confirm("Discard unsaved appointment changes?"))return;onClose();};
 const linked=opportunities.filter(o=>!value.personId||o.contact_id===value.personId);
 async function save(e:FormEvent){
  e.preventDefault();setError("");
  if(!value.title.trim()||!value.personId&&!value.opportunityId){setError("Enter a title and select a contact or admission.");return;}
  const start=Date.parse(value.startsAt+":00+05:30"),end=Date.parse(value.endsAt+":00+05:30");
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000){
   setError("The end time must be later than the start time, with a maximum duration of 24 hours.");return;
  }
  if(value.meetingUrl.trim()&&!/^https:\/\/\S+$/i.test(value.meetingUrl.trim())){setError("Use a full HTTPS meeting link.");return;}
  try{
   setBusy(true);
   await connectFetch("/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/calendar",{
    method:"POST",body:JSON.stringify({action:"save",data:{
     ...(appointment?{id:appointment.id,version:appointment.version}:{}),
     title:value.title.trim(),kind:value.kind,
     personId:value.personId||null,opportunityId:value.opportunityId||null,
     ownerMemberId:value.ownerMemberId||null,
     startsAt:fromIST(value.startsAt),endsAt:fromIST(value.endsAt),
     location:value.location.trim(),meetingUrl:value.meetingUrl.trim(),
     programme:value.programme.trim(),notes:value.notes.trim()
    }})
   });
   onSaved();onClose();
  }catch(e){setError(e instanceof Error?e.message:"Could not save this appointment.");}
  finally{setBusy(false);}
 }
 return <div className="ccal-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)requestClose();}}>
  <section className="ccal-modal" role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby="ccal-modal-heading">
   <header className="ccal-modal-head"><div><h2 id="ccal-modal-heading">{appointment?"Edit appointment":"New appointment"}</h2><p>All dates and times are in India Standard Time (IST)</p></div><button type="button" aria-label="Close appointment form" data-escape-close="true" onClick={requestClose} disabled={busy}>×</button></header>
   <form className="ccal-editor" onSubmit={save}>
    {error&&<p className="ccal-error" role="alert">{error}</p>}
    <label className="ccal-full">Appointment title<input required maxLength={250} value={value.title} onChange={e=>set("title",e.target.value)} placeholder="Robotics trial or parent counselling"/></label>
    <label>Type<select value={value.kind} onChange={e=>set("kind",e.target.value)}><option value="demo">Demo</option><option value="trial">Trial</option><option value="counselling">Counselling</option><option value="meeting">Meeting</option></select></label>
    <label>Contact<select value={value.personId} onChange={e=>{const id=e.target.value;setValue(v=>({...v,personId:id,opportunityId:opportunities.some(o=>o.id===v.opportunityId&&o.contact_id===id)?v.opportunityId:""}));}}>
     <option value="">Choose contact</option>{people.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
    <label>Starts (IST)<input type="datetime-local" required value={value.startsAt} onChange={e=>set("startsAt",e.target.value)}/></label>
    <label>Ends (IST)<input type="datetime-local" required value={value.endsAt} onChange={e=>set("endsAt",e.target.value)}/></label>
    <label>Linked admission<select value={value.opportunityId} onChange={e=>{const id=e.target.value;const opp=opportunities.find(o=>o.id===id);setValue(v=>({...v,opportunityId:id,personId:opp?.contact_id||v.personId}));}}>
      <option value="">No linked admission</option>{linked.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
    <label>Programme<input list="ccal-programmes" maxLength={160} placeholder="Robotics Club" value={value.programme} onChange={e=>set("programme",e.target.value)}/><datalist id="ccal-programmes">{programs.map(p=><option key={p.id} value={p.name}/>)}</datalist></label>
    {canManage&&<label>Assigned team member<select value={value.ownerMemberId} onChange={e=>set("ownerMemberId",e.target.value)}><option value="">Current owner / assign to me</option>{value.ownerMemberId&&!(staff.some(m=>m.id===value.ownerMemberId)||members.some(m=>m.member_id===value.ownerMemberId))&&<option value={value.ownerMemberId}>Previously assigned team member</option>}{staff.length?staff.map(m=><option key={m.id} value={m.id}>{m.label} · {m.role}</option>):members.filter(m=>m.member_status==="active").map(m=><option key={m.member_id} value={m.member_id}>{m.member_role} · {m.member_user_id.slice(0,8)}</option>)}</select></label>}
    <label>Meeting location<input maxLength={250} placeholder="Robotronix lab / Online" value={value.location} onChange={e=>set("location",e.target.value)}/></label>
    <label className="ccal-full">Meeting link<input type="url" maxLength={500} placeholder="https://..." value={value.meetingUrl} onChange={e=>set("meetingUrl",e.target.value)}/></label>
    <label className="ccal-full">Internal notes<textarea rows={3} maxLength={2000} placeholder="Agenda, preparation, or result of discussion" value={value.notes} onChange={e=>set("notes",e.target.value)}/></label>
    <footer className="ccal-modal-actions"><button type="button" className="ccal-action-secondary" disabled={busy} onClick={requestClose}>Cancel</button><button className="ccal-action-primary" disabled={busy} type="submit">{busy?"Saving…":appointment?"Save changes":"Create appointment"}</button></footer>
   </form>
  </section>
 </div>;
}
