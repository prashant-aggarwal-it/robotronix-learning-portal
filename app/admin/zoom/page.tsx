"use client";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {adminApi} from "@/lib/admin-api-client";

type Host={id:string;label:string;zoomEmail:string;status:string;enabled:boolean;priority:number;recordingEnabled:boolean;recordingRetentionDays:number;learnerRecordingDefault:boolean;lastSyncAt:string|null};
type Meeting={id:string;topic:string;status:string;scheduled_start:string;duration_minutes:number;recording_status:string;recording_enabled:boolean;event:any;presence:{trainerConnections:number;learnerConnections:number;trainerSeconds:number;learnerSeconds:number};recordings:any[]};
export default function ZoomAdmin(){return <RoleGuard allow={["admin"]}><AppShell role="admin"><Workspace/></AppShell></RoleGuard>}
function gb(bytes:number){return (bytes/1024/1024/1024).toFixed(bytes>=1024*1024*1024?2:3)+" GB";}
function mins(seconds:number){return Math.round(seconds/60)+" min";}
function Workspace(){
 const[hosts,setHosts]=useState<Host[]>([]),[meetings,setMeetings]=useState<Meeting[]>([]),[storage,setStorage]=useState<Array<{hostId:string;bytes:number}>>([]),[label,setLabel]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function load(){setError("");try{const x=await adminApi("/api/zoom/overview");setHosts(x.hosts||[]);setMeetings(x.meetings||[]);setStorage(x.storageByHost||[])}catch(e){setError(e instanceof Error?e.message:String(e))}}
 useEffect(()=>{load()},[]);
 const active=hosts.filter(h=>h.enabled&&h.status==="connected").length;
 const recent=useMemo(()=>meetings.slice(0,30),[meetings]);
 async function connect(){setBusy(true);setError("");try{const next=label.trim()||"Zoom Host "+(hosts.length+1);const x=await adminApi("/api/zoom/connect",{method:"POST",body:JSON.stringify({label:next})});window.location.assign(x.authorizationUrl)}catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false)}}
 async function patch(id:string,body:any){setBusy(true);setError("");try{await adminApi("/api/zoom/hosts",{method:"PATCH",body:JSON.stringify({id,...body})});await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 return <>
  <AdminPageHeader eyebrow="ONLINE CLASSROOM OPERATIONS" title="Zoom Classroom" description="Manage any number of independent Zoom host accounts, recording policy, class capacity and operational evidence from one place."/>
  {error&&<p className="errorBanner" role="alert">{error}</p>}
  <section className="experienceKpis">
   <div className="experienceKpi"><span>Connected hosts</span><b>{active}</b><small>Current simultaneous Zoom capacity</small></div>
   <div className="experienceKpi"><span>Recent classes</span><b>{meetings.length}</b><small>Latest provisioned Zoom classes</small></div>
   <div className="experienceKpi"><span>Recordings ready</span><b>{meetings.filter(m=>m.recording_status==="ready").length}</b><small>Across connected accounts</small></div>
  </section>

  <section className="dataSection"><div className="panelHeader"><div><div className="eyebrow">HOST POOL</div><h2>Zoom accounts</h2><p>Add Zoom accounts whenever capacity grows. Robotronix automatically selects an available enabled host for each online class.</p></div></div>
   <div className="row"><input className="input" style={{maxWidth:260}} placeholder={"e.g. Zoom Host "+(hosts.length+1)} value={label} onChange={e=>setLabel(e.target.value)}/><button className="button" disabled={busy} onClick={connect}>+ Add Zoom Account</button></div>
   <div className="tableWrap topGap"><table><thead><tr><th>Host</th><th>Account</th><th>Priority</th><th>Recording</th><th>Retention</th><th>Learner default</th><th>Storage tracked</th><th>Status</th></tr></thead><tbody>
   {hosts.length?hosts.map(h=><tr key={h.id}><td><b>{h.label}</b><div className="cellSub">{h.enabled?"Enabled":"Disabled"}</div></td><td>{h.zoomEmail||"Zoom account"}</td>
    <td><input className="input" type="number" min={1} max={9999} style={{width:90}} value={h.priority} disabled={busy} onChange={e=>patch(h.id,{priority:Number(e.target.value)})}/></td>
    <td><button className={"softBadge "+(h.recordingEnabled?"softGreen":"")} disabled={busy} onClick={()=>patch(h.id,{recordingEnabled:!h.recordingEnabled})}>{h.recordingEnabled?"Cloud recording ON":"Recording OFF"}</button></td>
    <td><select className="select" value={h.recordingRetentionDays} disabled={busy} onChange={e=>patch(h.id,{recordingRetentionDays:Number(e.target.value)})}><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option></select></td>
    <td><button className="softBadge" disabled={busy} onClick={()=>patch(h.id,{learnerRecordingDefault:!h.learnerRecordingDefault})}>{h.learnerRecordingDefault?"Visible":"Admin only"}</button></td>
    <td>{gb(storage.find(s=>s.hostId===h.id)?.bytes||0)}</td>
    <td><button className={"statusBadge status-"+(h.enabled?"active":"inactive")} disabled={busy} onClick={()=>patch(h.id,{enabled:!h.enabled})}>{h.enabled?"Active":"Disabled"}</button></td>
   </tr>):<tr><td colSpan={8}><div className="emptyState compact">No Zoom account connected yet.</div></td></tr>}
   </tbody></table></div>
  </section>

  <section className="dataSection"><div className="panelHeader"><div><div className="eyebrow">DELIVERY EVIDENCE</div><h2>Recent Zoom classes</h2><p>Presence is operational evidence only; verified academic attendance and class completion remain separate.</p></div><button className="button secondary" onClick={load}>Refresh</button></div>
   <div className="tableWrap"><table><thead><tr><th>Class</th><th>Scheduled</th><th>Zoom status</th><th>Trainer presence</th><th>Learner presence</th><th>Recording</th></tr></thead><tbody>
   {recent.length?recent.map(m=><tr key={m.id}><td><b>{m.event?.title||m.topic}</b></td><td>{new Date(m.scheduled_start).toLocaleString("en-IN")}</td><td><span className={"statusBadge status-"+m.status}>{m.status}</span></td><td>{m.presence.trainerConnections} connection{m.presence.trainerConnections===1?"":"s"} · {mins(m.presence.trainerSeconds)}</td><td>{m.presence.learnerConnections} connection{m.presence.learnerConnections===1?"":"s"} · {mins(m.presence.learnerSeconds)}</td><td>{m.recording_enabled?<span className="softBadge">{m.recording_status}</span>:"Off"}</td></tr>):<tr><td colSpan={6}><div className="emptyState compact">No production Zoom classes yet.</div></td></tr>}
   </tbody></table></div>
  </section>
 </>;
}
