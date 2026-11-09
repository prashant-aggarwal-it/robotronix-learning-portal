"use client";
import {useEffect,useState} from "react";
import {connectFetch,type ConnectOpportunity,type ConnectPerson} from "@/features/connect/api/client";

type Trainer={id:string;full_name:string;specialties:string[]};
type LinkedDemo={id:string;opportunity_id:string;person_id:string;portal_session_id:string|null;status:string;version:number;created_at:string;portalStatus?:string|null;trainerId?:string|null;schedule?:{date:string;start_time:string;timezone:string}|null;feedback?:Array<{attendance:string;summaryPublished:boolean;engagement:string|null;understanding:string|null;fit:string|null;parentRating:string|null}>};
type Response={ok:true;installed:boolean;trainers:Trainer[];demos:LinkedDemo[]};
type Props={tenantId:string;people:ConnectPerson[];opportunities:ConnectOpportunity[];canWrite:boolean;canManage:boolean};
const defaultDay=()=>new Date(Date.now()+86400000).toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});

export function ConnectPortalDemos({tenantId,people,opportunities,canWrite,canManage}:Props){
 const [data,setData]=useState<Response|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [open,setOpen]=useState(false),[guestUrl,setGuestUrl]=useState("");
 const [editing,setEditing]=useState<LinkedDemo|null>(null);
 const [form,setForm]=useState({opportunityId:"",learnerPersonId:"",trainerId:"",date:defaultDay(),startTime:"17:00",timezone:"Asia/Kolkata",grade:"",interest:"",durationMinutes:45});
 const base="/api/connect/workspaces/"+encodeURIComponent(tenantId);
 async function refresh(){const result=await connectFetch<Response>(base+"/portal-demos");setData(result);setForm(old=>({...old,opportunityId:old.opportunityId||opportunities[0]?.id||"",learnerPersonId:old.learnerPersonId||opportunities[0]?.contact_id||"",trainerId:old.trainerId||result.trainers[0]?.id||""}));}
 useEffect(()=>{let active=true;void connectFetch<Response>(base+"/portal-demos").then(result=>{if(active){setData(result);setForm(old=>({...old,opportunityId:old.opportunityId||opportunities[0]?.id||"",learnerPersonId:old.learnerPersonId||opportunities[0]?.contact_id||"",trainerId:old.trainerId||result.trainers[0]?.id||""}));}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Portal connection unavailable.");});return()=>{active=false;};},[base,opportunities]);
 async function configure(action:"enable"|"disable"){
  setBusy(true);setError("");try{await connectFetch(base+"/portal-integration",{method:"POST",body:JSON.stringify({action})});await refresh();setNotice(action==="enable"?"Learning Portal connected.":"Learning Portal disconnected.");}catch(e){setError(e instanceof Error?e.message:"Unable to update connection.");}finally{setBusy(false);}
 }
 async function book(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError("");setNotice("");setGuestUrl("");
  try{
   const result=await connectFetch<{status:string;linkId:string;guestUrl:string|null}>(base+"/portal-demos",{
    method:"POST",body:JSON.stringify({...form,requestId:crypto.randomUUID()})
   });
   await refresh();setOpen(false);setGuestUrl(result.guestUrl||"");setNotice(result.status==="scheduled"?"Demo booked in the Learning Portal. The trainer will see it in their demos.":"Booking received. Check status before sharing a link.");
  }catch(e){setError(e instanceof Error?e.message:"Could not book Portal demo.");}finally{setBusy(false);}
 }
 async function changeDemo(link:LinkedDemo,action:"cancel"|"reschedule"){
  if(busy)return;
  if(action==="cancel"&&!window.confirm("Cancel this Portal demo and Zoom meeting?"))return;
  setBusy(true);setError("");setNotice("");
  try{await connectFetch(base+"/portal-demos",{method:"PATCH",body:JSON.stringify({action,linkId:link.id,version:link.version,
   ...(action==="reschedule"?{trainerId:form.trainerId,date:form.date,startTime:form.startTime,timezone:form.timezone,durationMinutes:form.durationMinutes}:{})})});
   await refresh();setEditing(null);setNotice(action==="cancel"?"Portal demo cancelled.":"Demo and Zoom schedule updated.");
  }catch(e){setError(e instanceof Error?e.message:"Could not update demo.");}finally{setBusy(false);}
 }
 return <section className="cx-panel" aria-label="Connected Learning Portal demos" style={{marginBottom:20}}>
  <div className="cx-panel-header"><div><h2>Teaching demos · Learning Portal</h2><p>Book trainer-led demos here; the Learning Portal manages trainer schedules, Zoom and guest access.</p></div>
   {data?.installed&&canWrite&&<button type="button" className="cx-primary" onClick={()=>setOpen(v=>!v)}>{open?"Close booking":"＋ Book Portal demo"}</button>}
  </div>
  {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
  {notice&&<p role="status" style={{color:"#087f68"}}>{notice}</p>}
  {guestUrl&&<p><strong>Guest link (copy now):</strong> <a href={guestUrl} target="_blank" rel="noopener noreferrer">Open guest page</a> <button type="button" className="cx-secondary" onClick={()=>void navigator.clipboard.writeText(guestUrl)}>Copy link</button></p>}
  {!data&&<p>Loading Learning Portal connection…</p>}
  {data&&!data.installed&&<div><p>CRM appointments remain available independently. Connect the Portal to enable trainer assignment and Zoom demos.</p>{canManage&&<button type="button" className="cx-primary" disabled={busy} onClick={()=>void configure("enable")}>Connect Learning Portal</button>}{!canManage&&<p>Ask your CRM administrator to connect the Learning Portal.</p>}</div>}
  {data?.installed&&<>
   <p style={{fontSize:13}}>Connected · {data.trainers.length} active trainers · {data.demos.length} linked demos</p>
   {open&&<form onSubmit={e=>void book(e)} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(195px,1fr))",gap:12,margin:"14px 0"}}>
    <label>Admission *<select required value={form.opportunityId} onChange={e=>{const o=opportunities.find(x=>x.id===e.target.value);setForm(f=>({...f,opportunityId:e.target.value,learnerPersonId:o?.contact_id||""}));}}>{opportunities.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
    <label>Learner contact *<select required value={form.learnerPersonId} onChange={e=>setForm(f=>({...f,learnerPersonId:e.target.value}))}>{people.map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}</select><small>Must be linked to the admission.</small></label>
    <label>Portal trainer *<select required value={form.trainerId} onChange={e=>setForm(f=>({...f,trainerId:e.target.value}))}>{data.trainers.map(t=><option value={t.id} key={t.id}>{t.full_name}</option>)}</select></label>
    <label>Date *<input required type="date" min={defaultDay()} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></label>
    <label>Start time (IST) *<input required type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))}/></label>
    <label>Duration *<select value={form.durationMinutes} onChange={e=>setForm(f=>({...f,durationMinutes:Number(e.target.value)}))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label>
    <label>Grade / level *<input required maxLength={80} value={form.grade} onChange={e=>setForm(f=>({...f,grade:e.target.value}))}/></label>
    <label>Programme focus<input maxLength={160} value={form.interest} onChange={e=>setForm(f=>({...f,interest:e.target.value}))}/></label>
    <div style={{alignSelf:"end"}}><button type="submit" className="cx-primary" disabled={busy||!data.trainers.length}>{busy?"Booking…":"Confirm demo booking"}</button></div>
   </form>}
   {data.demos.length>0&&<div style={{display:"grid",gap:8,marginTop:12}}>{data.demos.slice(0,12).map(d=><div key={d.id} style={{display:"flex",gap:12,justifyContent:"space-between",padding:"10px 12px",border:"1px solid #dce8ef",borderRadius:10,flexWrap:"wrap"}}><span>{opportunities.find(o=>o.id===d.opportunity_id)?.title||"Admission"} · {people.find(p=>p.id===d.person_id)?.full_name||"Learner"}<small style={{display:"block"}}>{d.schedule?.date||""} {d.schedule?.start_time?.slice(0,5)||""} · {data.trainers.find(t=>t.id===d.trainerId)?.full_name||""}</small>{d.feedback?.map((f,i)=><small key={i} style={{display:"block",color:"#087f68"}}>{f.summaryPublished?`Trainer summary: ${f.engagement||""} engagement · ${f.fit||""} fit${f.parentRating?" · Parent: "+f.parentRating:""}`:f.attendance==="no_show"?"Learner did not attend — follow-up needed":""}</small>)}</span><span>{d.portalStatus||d.status} {canWrite&&d.status==="scheduled"&&d.portalStatus==="scheduled"&&<><button type="button" className="cx-secondary" disabled={busy} onClick={()=>{setEditing(d);setForm(f=>({...f,trainerId:d.trainerId||f.trainerId,date:d.schedule?.date||f.date,startTime:d.schedule?.start_time?.slice(0,5)||f.startTime}));}}>Reschedule</button><button type="button" className="cx-secondary" disabled={busy} onClick={()=>void changeDemo(d,"cancel")}>Cancel</button></>}</span></div>)}</div>}
   {editing&&<form onSubmit={e=>{e.preventDefault();void changeDemo(editing,"reschedule");}} style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:14}}><strong>Reschedule Portal demo</strong><select value={form.trainerId} onChange={e=>setForm(f=>({...f,trainerId:e.target.value}))}>{data.trainers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select><input type="date" min={defaultDay()} required value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/><input type="time" required value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))}/><select value={form.durationMinutes} onChange={e=>setForm(f=>({...f,durationMinutes:Number(e.target.value)}))}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option><option value={90}>90 min</option></select><button className="cx-primary" type="submit" disabled={busy}>Update demo</button><button type="button" className="cx-secondary" onClick={()=>setEditing(null)}>Close</button></form>}
   {canManage&&<details style={{marginTop:12}}><summary>Portal connection settings</summary><button type="button" className="cx-secondary" disabled={busy} onClick={()=>void configure("disable")}>Disconnect Portal</button><p>Disconnecting stops new CRM bookings; existing Portal demos remain intact.</p></details>}
  </>}
 </section>;
}
