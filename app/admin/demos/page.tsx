"use client";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {adminApi} from "@/lib/admin-api-client";
import {listAdminTrainers} from "@/lib/repository";
import type {TrainerAdminRecord} from "@/lib/types";
import {subscribeNotifications} from "@/lib/communication-repository";

type Session={id:string;session_type:"one_to_one"|"group";focus:string;status:string;created_at:string;schedule_event:any;trainer:any;participants:any[]};
type RequestRow={id:string;demo_session_participant_id:string;request_type:string;message:string;status:string;created_at:string;participant?:{id:string;lead?:{child_name?:string;parent_name?:string}|null;demo_session?:{id:string;focus?:string;schedule_event?:{date?:string;start_time?:string;timezone?:string}|null}|null}|null};

const today=()=>new Date().toISOString().slice(0,10);
export default function AdminDemos(){return <RoleGuard allow={["admin"]}><AppShell role="admin"><Workspace/></AppShell></RoleGuard>}

function Workspace(){
 const[sessions,setSessions]=useState<Session[]>([]),[requests,setRequests]=useState<RequestRow[]>([]),[trainers,setTrainers]=useState<TrainerAdminRecord[]>([]);
 const[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[mode,setMode]=useState<"create"|"add">("create");
 const[form,setForm]=useState({sessionId:"",sessionType:"one_to_one",parentName:"",parentWhatsApp:"",parentEmail:"",childName:"",grade:"",interest:"Robotics",experienceLevel:"new",source:"manual",trainerId:"",date:today(),startTime:"17:00",durationMinutes:45,timezone:"Asia/Kolkata",focus:"Robotics Discovery"});
 async function load(){setError("");try{const[x,t]=await Promise.all([adminApi("/api/admin/demos"),listAdminTrainers()]);setSessions(x.sessions||[]);setRequests(x.requests||[]);const active=t.filter(x=>x.recordStatus==="active");setTrainers(active);setForm(v=>({...v,trainerId:v.trainerId||active[0]?.id||""}))}catch(e){setError(e instanceof Error?e.message:String(e))}}
 useEffect(()=>{void load();const unsubscribe=subscribeNotifications("admin",()=>void load());const resume=()=>{if(navigator.onLine!==false)void load()};window.addEventListener("focus",resume);window.addEventListener("online",resume);return()=>{unsubscribe();window.removeEventListener("focus",resume);window.removeEventListener("online",resume)}},[]);
 const upcomingGroups=useMemo(()=>sessions.filter(s=>s.session_type==="group"&&s.status==="scheduled"),[sessions]);
 const counts=useMemo(()=>({upcoming:sessions.filter(s=>s.status==="scheduled").length,completed:sessions.filter(s=>s.status==="completed").length,participants:sessions.reduce((n,s)=>n+(s.participants?.length||0),0),requests:requests.length}),[sessions,requests]);
 const requestCounts=useMemo(()=>{const map=new Map<string,number>();for(const r of requests)map.set(r.demo_session_participant_id,(map.get(r.demo_session_participant_id)||0)+1);return map},[requests]);
 async function save(){setBusy(true);setError("");setNotice("");try{
  const payload=mode==="add"?{...form,action:"add_participant"}:{...form,action:"create"};
  const x=await adminApi("/api/admin/demos",{method:"POST",body:JSON.stringify(payload)});
  if(x.guestUrl){await navigator.clipboard.writeText(x.guestUrl).catch(()=>{});setNotice("Demo saved. Secure parent link copied to clipboard: "+x.guestUrl)}
  setForm(v=>({...v,parentName:"",parentWhatsApp:"",parentEmail:"",childName:"",grade:"",experienceLevel:"new"}));await load();
 }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function guestLink(participantId:string){setBusy(true);try{const x=await adminApi("/api/admin/demos",{method:"POST",body:JSON.stringify({action:"regenerate_link",participantId})});await navigator.clipboard.writeText(x.guestUrl);setNotice("New secure demo link copied. The previous guest link is now invalid.")}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function resolveRequest(requestId:string){setBusy(true);setError("");try{await adminApi("/api/admin/demos",{method:"POST",body:JSON.stringify({action:"resolve_request",requestId})});setNotice("Guest request marked resolved.");await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}

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
    {mode==="add"&&<label><span>Group demo</span><select className="select" value={form.sessionId} onChange={e=>setForm(v=>({...v,sessionId:e.target.value}))}>{upcomingGroups.map(s=><option key={s.id} value={s.id}>{s.focus} · {s.schedule_event?.date} {String(s.schedule_event?.start_time||"").slice(0,5)}</option>)}</select></label>}
    {mode==="create"&&<label><span>Demo type</span><select className="select" value={form.sessionType} onChange={e=>setForm(v=>({...v,sessionType:e.target.value}))}><option value="one_to_one">1-to-1 Discovery</option><option value="group">Group Discovery</option></select></label>}
    <label><span>Parent name *</span><input className="input" value={form.parentName} onChange={e=>setForm(v=>({...v,parentName:e.target.value}))}/></label>
    <label><span>WhatsApp *</span><input className="input" value={form.parentWhatsApp} onChange={e=>setForm(v=>({...v,parentWhatsApp:e.target.value}))} placeholder="+91…"/></label>
    <label><span>Child name *</span><input className="input" value={form.childName} onChange={e=>setForm(v=>({...v,childName:e.target.value}))}/></label>
    <label><span>Grade / age band *</span><input className="input" value={form.grade} onChange={e=>setForm(v=>({...v,grade:e.target.value}))} placeholder="e.g. Grade 6"/></label>
    <label><span>Interest *</span><select className="select" value={form.interest} onChange={e=>setForm(v=>({...v,interest:e.target.value,focus:e.target.value+" Discovery"}))}><option>Robotics</option><option>Coding</option><option>Arduino</option><option>Python</option><option>Scratch</option><option>AI & Future Skills</option></select></label>
    <label><span>Experience</span><select className="select" value={form.experienceLevel} onChange={e=>setForm(v=>({...v,experienceLevel:e.target.value}))}><option value="new">New</option><option value="some">Some experience</option><option value="experienced">Experienced</option></select></label>
    {mode==="create"&&<><label><span>Trainer *</span><select className="select" value={form.trainerId} onChange={e=>setForm(v=>({...v,trainerId:e.target.value}))}>{trainers.map(t=><option value={t.id} key={t.id}>{t.fullName}</option>)}</select></label>
    <label><span>Date *</span><input className="input" type="date" min={today()} value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))}/></label>
    <label><span>Start time *</span><input className="input" type="time" step={1800} value={form.startTime} onChange={e=>setForm(v=>({...v,startTime:e.target.value}))}/></label>
    <label><span>Duration</span><select className="select" value={form.durationMinutes} onChange={e=>setForm(v=>({...v,durationMinutes:Number(e.target.value)}))}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option></select></label>
    <label><span>Demo focus</span><input className="input" value={form.focus} onChange={e=>setForm(v=>({...v,focus:e.target.value}))}/></label></>}
    <label><span>Email (optional)</span><input className="input" type="email" value={form.parentEmail} onChange={e=>setForm(v=>({...v,parentEmail:e.target.value}))}/></label>
   </div>
   <div className="row topGap"><button className="button" disabled={busy||!form.parentName.trim()||!form.parentWhatsApp.trim()||!form.childName.trim()||!form.grade.trim()||!form.interest.trim()||(mode==="create"&&(!form.trainerId||!form.date||!form.startTime))||(mode==="add"&&!form.sessionId)} onClick={save}>{busy?"Saving…":mode==="add"?"Add learner & copy guest link":"Schedule demo & copy guest link"}</button><span className="muted">The trainer will never receive WhatsApp or email details.</span></div>
  </section>

  {requests.length>0&&<section className="dataSection"><div className="panelHeader"><div><div className="eyebrow">NEEDS ATTENTION</div><h2>Guest requests</h2><p>Every request is tied to the learner and discovery session so nothing gets lost between demos.</p></div></div><div className="tableWrap"><table><thead><tr><th>Demo</th><th>Learner</th><th>Request</th><th>Message</th><th>Received</th><th>Action</th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td><b>{r.participant?.demo_session?.focus||"Discovery session"}</b><div className="cellSub">{r.participant?.demo_session?.schedule_event?.date||""}</div></td><td><b>{r.participant?.lead?.child_name||"Learner"}</b><div className="cellSub">{r.participant?.lead?.parent_name||"Parent / guardian"}</div></td><td><span className="statusBadge status-pending">{r.request_type}</span></td><td>{r.message||"Help requested"}</td><td>{new Date(r.created_at).toLocaleString("en-IN")}</td><td><button className="button secondary small" disabled={busy} onClick={()=>resolveRequest(r.id)}>Mark resolved</button></td></tr>)}</tbody></table></div></section>}

  <section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">DEMO PIPELINE</div><h2>Discovery sessions</h2><p>Group sessions keep one shared Zoom meeting while every family receives a separate private guest experience and outcome.</p></div><button className="button secondary" onClick={load}>Refresh data</button></div>
   <div className="tableWrap"><table><thead><tr><th>Demo</th><th>When</th><th>Trainer</th><th>Learners</th><th>Status</th><th>Requests</th><th>Parent guest link</th></tr></thead><tbody>
    {sessions.map(s=><tr key={s.id}><td><b>{s.focus}</b><div className="cellSub">{s.session_type==="group"?"Group Discovery":"1-to-1 Discovery"}</div></td><td>{s.schedule_event?.date}<div className="cellSub">{String(s.schedule_event?.start_time||"").slice(0,5)} · {s.schedule_event?.timezone}</div></td><td>{s.trainer?.full_name||"—"}</td><td>{s.participants?.map((p:any)=><div key={p.id}><b>{p.lead?.child_name}</b><span className="cellSub">{p.lead?.grade} · {p.lead?.interest}</span></div>)}</td><td><span className={"statusBadge status-"+(s.status==="completed"?"active":s.status==="scheduled"?"pending":"inactive")}>{s.status}</span></td><td>{s.participants?.reduce((n:number,p:any)=>n+(requestCounts.get(p.id)||0),0)?<span className="statusBadge status-pending">{s.participants?.reduce((n:number,p:any)=>n+(requestCounts.get(p.id)||0),0)} open</span>:<span className="cellSub">None</span>}</td><td><div className="demoGuestLinkStack">{s.participants?.map((p:any)=><button key={p.id} className="button secondary small" disabled={busy} onClick={()=>guestLink(p.id)}>Regenerate guest link · {p.lead?.child_name}</button>)}</div></td></tr>)}
    {!sessions.length&&<tr><td colSpan={7}><div className="emptyState compact">No demos yet. Schedule the first discovery session above.</div></td></tr>}
   </tbody></table></div>
  </section>
 </>;
}
