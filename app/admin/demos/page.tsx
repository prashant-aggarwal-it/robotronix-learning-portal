"use client";
import {useEffect,useMemo,useState} from "react";
import {FormErrorSummary} from "@/components/admin/FormErrorSummary";
import {readableSaveError,type FormIssue} from "@/lib/form-errors";
import {validInternationalPhone} from "@/lib/phones";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {adminApi} from "@/lib/admin-api-client";
import {listAdminTrainers} from "@/lib/repository";
import type {TrainerAdminRecord} from "@/lib/types";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";

type Session={id:string;session_type:"one_to_one"|"group";focus:string;status:string;created_at:string;schedule_event:any;trainer:any;participants:any[]};
type RequestRow={id:string;demo_session_participant_id:string;request_type:string;message:string;status:string;created_at:string;participant?:{id:string;lead?:{child_name?:string;parent_name?:string}|null;demo_session?:{id:string;focus?:string;schedule_event?:{date?:string;start_time?:string;timezone?:string}|null}|null}|null};

const today=()=>new Date().toISOString().slice(0,10);
export default function AdminDemos(){return <RoleGuard allow={["admin"]}><AppShell role="admin"><Workspace/></AppShell></RoleGuard>}

function Workspace(){
 const[sessions,setSessions]=useState<Session[]>([]),[requests,setRequests]=useState<RequestRow[]>([]),[trainers,setTrainers]=useState<TrainerAdminRecord[]>([]);
 const[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[formIssues,setFormIssues]=useState<FormIssue[]>([]),[rescheduleIssues,setRescheduleIssues]=useState<FormIssue[]>([]),[mode,setMode]=useState<"create"|"add">("create");
 const[editing,setEditing]=useState<Session|null>(null),[reschedule,setReschedule]=useState({trainerId:"",date:"",startTime:"",durationMinutes:45,timezone:"Asia/Kolkata"});
 const[form,setForm]=useState({sessionId:"",sessionType:"one_to_one",parentName:"",parentWhatsApp:"",parentEmail:"",childName:"",grade:"",interest:"Robotics",experienceLevel:"new",source:"manual",trainerId:"",date:today(),startTime:"17:00",durationMinutes:45,timezone:"Asia/Kolkata",focus:"Robotics Discovery"});
 async function load(){setError("");try{const[x,t]=await Promise.all([adminApi("/api/admin/demos"),listAdminTrainers()]);setSessions(x.sessions||[]);setRequests(x.requests||[]);const active=t.filter(x=>x.recordStatus==="active");setTrainers(active);setForm(v=>({...v,trainerId:v.trainerId||active[0]?.id||""}))}catch(e){setError(readableSaveError(e))}}
 useEffect(()=>{void load()},[]);
 useLiveRefresh(["demo_guest_requests","demo_sessions","demo_session_participants"],load,"admin-demos");
 const upcomingGroups=useMemo(()=>sessions.filter(s=>s.session_type==="group"&&s.status==="scheduled"),[sessions]);
 const counts=useMemo(()=>({upcoming:sessions.filter(s=>s.status==="scheduled").length,completed:sessions.filter(s=>s.status==="completed").length,participants:sessions.reduce((n,s)=>n+(s.participants?.length||0),0),requests:requests.length}),[sessions,requests]);
 const requestCounts=useMemo(()=>{const map=new Map<string,number>();for(const r of requests)map.set(r.demo_session_participant_id,(map.get(r.demo_session_participant_id)||0)+1);return map},[requests]);
 async function save(){if(busy)return;
 const issues:FormIssue[]=[];
 if(!form.parentName?.trim())issues.push({field:"demoParent",message:"Enter the parent or guardian's name."});
 if(!validInternationalPhone(form.parentWhatsApp||""))issues.push({field:"demoWhatsapp",message:"Enter a valid WhatsApp number with country code."});
 if(!form.childName?.trim())issues.push({field:"demoChild",message:"Enter the learner's name."});
 if(!form.grade?.trim())issues.push({field:"demoGrade",message:"Enter the learner's grade or age band."});
 if(!form.interest?.trim())issues.push({field:"demoInterest",message:"Choose an interest."});
 if(mode==="add"&&!form.sessionId)issues.push({field:"demoGroup",message:"Choose a group demo."});
 if(mode==="create"&&!form.trainerId)issues.push({field:"demoTrainer",message:"Assign a trainer."});
 if(mode==="create"&&(!form.date||form.date<today()))issues.push({field:"demoDate",message:"Choose a date that is not in the past."});
 if(mode==="create"&&!form.startTime)issues.push({field:"demoTime",message:"Choose the demo start time."});
 setFormIssues(issues);if(issues.length){setError("Correct the highlighted demo details before saving.");return;}
 setBusy(true);setError("");setNotice("");try{
  const payload=mode==="add"?{...form,action:"add_participant"}:{...form,action:"create"};
  const x=await adminApi("/api/admin/demos",{method:"POST",body:JSON.stringify(payload)});
  if(x.guestUrl){let copied=true;try{await navigator.clipboard.writeText(x.guestUrl)}catch{copied=false}setNotice(copied?"Demo saved. Secure parent link copied.":"Demo saved. Open the demo details to copy the secure parent link.")}else{setNotice("Demo saved successfully.")}
  setForm(v=>({...v,parentName:"",parentWhatsApp:"",parentEmail:"",childName:"",grade:"",experienceLevel:"new"}));await load();
 }catch(e){setError(readableSaveError(e))}finally{setBusy(false)}}
 async function guestLink(participantId:string){if(busy)return;setBusy(true);try{const x=await adminApi("/api/admin/demos",{method:"POST",body:JSON.stringify({action:"regenerate_link",participantId})});await navigator.clipboard.writeText(x.guestUrl);setNotice("New secure demo link copied. The previous guest link is now invalid.")}catch(e){setError(readableSaveError(e))}finally{setBusy(false)}}
 async function resolveRequest(requestId:string){if(busy)return;setBusy(true);setError("");try{await adminApi("/api/admin/demos",{method:"POST",body:JSON.stringify({action:"resolve_request",requestId})});setNotice("Guest request marked resolved.");await load()}catch(e){setError(readableSaveError(e))}finally{setBusy(false)}}
 function openReschedule(s:Session){const start=String(s.schedule_event?.start_time||"").slice(0,5);const mins=Math.max(30,Math.round(((Number(String(s.schedule_event?.end_time||"00:00").slice(0,2))*60+Number(String(s.schedule_event?.end_time||"00:00").slice(3,5)))-(Number(start.slice(0,2))*60+Number(start.slice(3,5))))||45));setEditing(s);setReschedule({trainerId:s.trainer?.id||"",date:s.schedule_event?.date||today(),startTime:start||"17:00",durationMinutes:[30,45,60].includes(mins)?mins:45,timezone:s.schedule_event?.timezone||"Asia/Kolkata"})}
 async function saveReschedule(){if(!editing||busy)return;
 const issues:FormIssue[]=[];
 if(!reschedule.trainerId)issues.push({field:"rescheduleTrainer",message:"Choose the demo trainer."});
 if(!reschedule.date||reschedule.date<today())issues.push({field:"rescheduleDate",message:"Choose a future or current date."});
 if(!reschedule.startTime)issues.push({field:"rescheduleTime",message:"Choose the new start time."});
 setRescheduleIssues(issues);if(issues.length){setError("Correct the highlighted reschedule details.");return;}
 setBusy(true);setError("");try{await adminApi("/api/admin/demos",{method:"POST",body:JSON.stringify({action:"reschedule",sessionId:editing.id,...reschedule})});setNotice("Demo rescheduled. Zoom and the assigned trainer were updated.");setEditing(null);await load()}catch(e){setError(readableSaveError(e))}finally{setBusy(false)}}
 async function cancelSession(s:Session){if(busy)return;if(!window.confirm("Cancel this demo for all learners in the session?"))return;setBusy(true);setError("");try{await adminApi("/api/admin/demos",{method:"POST",body:JSON.stringify({action:"cancel_session",sessionId:s.id})});setNotice("Demo cancelled and the Zoom meeting was closed.");await load()}catch(e){setError(readableSaveError(e))}finally{setBusy(false)}}
 
 return <>
  <AdminPageHeader eyebrow="FIRST IMPRESSION EXPERIENCE" title="Demo Experience" description="Create a polished discovery journey before onboarding. Capture only the minimum, protect family contact details from trainers, and turn every demo into a personalised next step."/>
  {error&&<p className="errorBanner" role="alert">{error}</p>}{notice&&<p className="successBanner" role="status">{notice}</p>}
  <section className="experienceKpis">
   <div className="experienceKpi"><span>Upcoming demos</span><b>{counts.upcoming}</b><small>1-to-1 and group</small></div>
   <div className="experienceKpi"><span>Completed</span><b>{counts.completed}</b><small>Discovery sessions finished</small></div>
   <div className="experienceKpi"><span>Learners reached</span><b>{counts.participants}</b><small>Across all demos</small></div>
   <div className="experienceKpi"><span>Needs attention</span><b>{counts.requests}</b><small>Guest help / reschedule requests</small></div>
  </section>

  <section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">QUICK DEMO SETUP</div><h2>Minimum details. Premium experience.</h2><p>Only five learner/contact fields are mandatory. Full onboarding happens only after the family decides to continue.</p></div><div className="row"><button className={mode==="create"?"button":"button secondary"} onClick={()=>setMode("create")}>New demo</button><button className={mode==="add"?"button":"button secondary"} disabled={!upcomingGroups.length} onClick={()=>{setMode("add");setForm(v=>({...v,sessionId:v.sessionId||upcomingGroups[0]?.id||""}))}}>Add learner to group</button></div></div>
   <div className="demoAdminForm">
    {mode==="add"&&<label id="field-demoGroup" tabIndex={-1} style={formIssues.some(x=>x.field==="demoGroup")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Group demo</span><select className="select" value={form.sessionId} onChange={e=>setForm(v=>({...v,sessionId:e.target.value}))}>{upcomingGroups.map(s=><option key={s.id} value={s.id}>{s.focus} · {s.schedule_event?.date} {String(s.schedule_event?.start_time||"").slice(0,5)}</option>)}</select></label>}
    {mode==="create"&&<label><span>Demo type</span><select className="select" value={form.sessionType} onChange={e=>setForm(v=>({...v,sessionType:e.target.value}))}><option value="one_to_one">1-to-1 Discovery</option><option value="group">Group Discovery</option></select></label>}
    <label id="field-demoParent" tabIndex={-1} style={formIssues.some(x=>x.field==="demoParent")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Parent name *</span><input className="input" value={form.parentName} onChange={e=>setForm(v=>({...v,parentName:e.target.value}))}/></label>
    <label id="field-demoWhatsapp" tabIndex={-1} style={formIssues.some(x=>x.field==="demoWhatsapp")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>WhatsApp *</span><input className="input" value={form.parentWhatsApp} onChange={e=>setForm(v=>({...v,parentWhatsApp:e.target.value}))} placeholder="+91…"/></label>
    <label id="field-demoChild" tabIndex={-1} style={formIssues.some(x=>x.field==="demoChild")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Child name *</span><input className="input" value={form.childName} onChange={e=>setForm(v=>({...v,childName:e.target.value}))}/></label>
    <label id="field-demoGrade" tabIndex={-1} style={formIssues.some(x=>x.field==="demoGrade")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Grade / age band *</span><input className="input" value={form.grade} onChange={e=>setForm(v=>({...v,grade:e.target.value}))} placeholder="e.g. Grade 6"/></label>
    <label id="field-demoInterest" tabIndex={-1} style={formIssues.some(x=>x.field==="demoInterest")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Interest *</span><select className="select" value={form.interest} onChange={e=>setForm(v=>({...v,interest:e.target.value,focus:e.target.value+" Discovery"}))}><option>Robotics</option><option>Coding</option><option>Arduino</option><option>Python</option><option>Scratch</option><option>AI & Future Skills</option></select></label>
    <label><span>Experience</span><select className="select" value={form.experienceLevel} onChange={e=>setForm(v=>({...v,experienceLevel:e.target.value}))}><option value="new">New</option><option value="some">Some experience</option><option value="experienced">Experienced</option></select></label>
    {mode==="create"&&<><label id="field-demoTrainer" tabIndex={-1} style={formIssues.some(x=>x.field==="demoTrainer")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Trainer *</span><select className="select" value={form.trainerId} onChange={e=>setForm(v=>({...v,trainerId:e.target.value}))}>{trainers.map(t=><option value={t.id} key={t.id}>{t.fullName}</option>)}</select></label>
    <label id="field-demoDate" tabIndex={-1} style={formIssues.some(x=>x.field==="demoDate")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Date *</span><input className="input" type="date" min={today()} value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))}/></label>
    <label id="field-demoTime" tabIndex={-1} style={formIssues.some(x=>x.field==="demoTime")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Start time *</span><input className="input" type="time" step={1800} value={form.startTime} onChange={e=>setForm(v=>({...v,startTime:e.target.value}))}/></label>
    <label><span>Duration</span><select className="select" value={form.durationMinutes} onChange={e=>setForm(v=>({...v,durationMinutes:Number(e.target.value)}))}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option></select></label>
    <label><span>Demo focus</span><input className="input" value={form.focus} onChange={e=>setForm(v=>({...v,focus:e.target.value}))}/></label></>}
    <label><span>Email (optional)</span><input className="input" type="email" value={form.parentEmail} onChange={e=>setForm(v=>({...v,parentEmail:e.target.value}))}/></label>
   </div>
   <FormErrorSummary issues={formIssues}/><div className="row topGap"><button className="button" disabled={busy} onClick={save}>{busy?"Saving…":mode==="add"?"Add learner & copy guest link":"Schedule demo & copy guest link"}</button><span className="muted">The trainer will never receive WhatsApp or email details.</span></div>
  </section>

  {requests.length>0&&<section className="dataSection"><div className="panelHeader"><div><div className="eyebrow">NEEDS ATTENTION</div><h2>Guest requests</h2><p>Every request is tied to the learner and discovery session so nothing gets lost between demos.</p></div></div><div className="tableWrap"><table><thead><tr><th>Demo</th><th>Learner</th><th>Request</th><th>Message</th><th>Received</th><th>Action</th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td><b>{r.participant?.demo_session?.focus||"Discovery session"}</b><div className="cellSub">{r.participant?.demo_session?.schedule_event?.date||""}</div></td><td><b>{r.participant?.lead?.child_name||"Learner"}</b><div className="cellSub">{r.participant?.lead?.parent_name||"Parent / guardian"}</div></td><td><span className="statusBadge status-pending">{r.request_type}</span></td><td>{r.message||"Help requested"}</td><td>{new Date(r.created_at).toLocaleString("en-IN")}</td><td><button className="button secondary small" disabled={busy} onClick={()=>resolveRequest(r.id)}>Mark resolved</button></td></tr>)}</tbody></table></div></section>}

  <section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">DEMO PIPELINE</div><h2>Discovery sessions</h2><p>Group sessions keep one shared Zoom meeting while every family receives a separate private guest experience and outcome.</p></div><button className="button secondary" onClick={load}>Refresh data</button></div>
   <div className="tableWrap"><table><thead><tr><th>Demo</th><th>When</th><th>Trainer</th><th>Learners</th><th>Status</th><th>Requests</th><th>Parent guest link</th><th>Actions</th></tr></thead><tbody>
    {sessions.map(s=><tr key={s.id}><td><b>{s.focus}</b><div className="cellSub">{s.session_type==="group"?"Group Discovery":"1-to-1 Discovery"}</div></td><td>{s.schedule_event?.date}<div className="cellSub">{String(s.schedule_event?.start_time||"").slice(0,5)} · {s.schedule_event?.timezone}</div></td><td>{s.trainer?.full_name||"—"}</td><td><div className="demoLearnerOps">{s.participants?.map((p:any)=><div key={p.id}><div><b>{p.lead?.child_name}</b><span className="cellSub">{p.lead?.grade} · {p.lead?.interest}</span></div></div>)}</div></td><td><span className={"statusBadge status-"+(s.status==="completed"?"active":s.status==="scheduled"?"pending":"inactive")}>{s.status}</span></td><td>{s.participants?.reduce((n:number,p:any)=>n+(requestCounts.get(p.id)||0),0)?<span className="statusBadge status-pending">{s.participants?.reduce((n:number,p:any)=>n+(requestCounts.get(p.id)||0),0)} open</span>:<span className="cellSub">None</span>}</td><td><div className="demoGuestLinkStack">{s.participants?.map((p:any)=><button key={p.id} className="button secondary small" disabled={busy} onClick={()=>guestLink(p.id)}>Regenerate guest link · {p.lead?.child_name}</button>)}</div></td><td><div className="row" style={{flexWrap:"wrap"}}>{s.status==="scheduled"&&<button className="button secondary small" disabled={busy} onClick={()=>openReschedule(s)}>Reschedule</button>}{s.status==="scheduled"&&<button className="button ghost small" disabled={busy} onClick={()=>cancelSession(s)}>Cancel</button>}</div></td></tr>)}
    {!sessions.length&&<tr><td colSpan={8}><div className="emptyState compact">No demos yet. Schedule the first discovery session above.</div></td></tr>}
   </tbody></table></div>
  </section>
  {editing&&<div className="demoModalBackdrop" onMouseDown={()=>setEditing(null)}><section className="demoModal" onMouseDown={e=>e.stopPropagation()}><span className="demoPill neutral">RESCHEDULE DEMO</span><h2>{editing.focus}</h2><p>Update the live Zoom meeting, trainer assignment and parent join window in one step.</p><div className="demoOutcomeForm">
   <label id="field-rescheduleTrainer" tabIndex={-1} style={rescheduleIssues.some(x=>x.field==="rescheduleTrainer")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Trainer</span><select className="select" value={reschedule.trainerId} onChange={e=>setReschedule(v=>({...v,trainerId:e.target.value}))}>{trainers.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label>
   <label id="field-rescheduleDate" tabIndex={-1} style={rescheduleIssues.some(x=>x.field==="rescheduleDate")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Date</span><input className="input" type="date" min={today()} value={reschedule.date} onChange={e=>setReschedule(v=>({...v,date:e.target.value}))}/></label>
   <label id="field-rescheduleTime" tabIndex={-1} style={rescheduleIssues.some(x=>x.field==="rescheduleTime")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><span>Start time</span><input className="input" type="time" step={1800} value={reschedule.startTime} onChange={e=>setReschedule(v=>({...v,startTime:e.target.value}))}/></label>
   <label><span>Duration</span><select className="select" value={reschedule.durationMinutes} onChange={e=>setReschedule(v=>({...v,durationMinutes:Number(e.target.value)}))}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option></select></label>
  </div><FormErrorSummary issues={rescheduleIssues}/><div className="row topGap"><button className="button" disabled={busy} onClick={saveReschedule}>{busy?"Updating…":"Update demo"}</button><button className="button secondary" onClick={()=>setEditing(null)}>Close</button></div></section></div>}
 </>;
}
