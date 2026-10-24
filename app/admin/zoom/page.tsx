"use client";
import {Suspense,useEffect,useMemo,useState} from "react";
import {useSearchParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {adminApi} from "@/lib/admin-api-client";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";

type Host={id:string;label:string;zoomEmail:string;status:string;enabled:boolean;priority:number;recordingEnabled:boolean;recordingRetentionDays:number;learnerRecordingDefault:boolean;lastSyncAt:string|null};
type Recording={id:string;recording_type:string;file_type:string;file_size_bytes:number;recording_start:string|null;status:string;learner_visible:boolean;retain_until:string|null;protected_from_deletion:boolean};
type Meeting={id:string;purpose:"class"|"general"|"demo";topic:string;status:string;scheduled_start:string;duration_minutes:number;recording_status:string;recording_enabled:boolean;join_url?:string|null;passcode?:string|null;meeting_notes?:string|null;event:any;host?:{label:string;email:string}|null;presence:any;recordings:Recording[]};

export default function ZoomAdmin(){return <RoleGuard allow={["admin"]}><AppShell role="admin"><Suspense fallback={<p>Loading Zoom administration…</p>}><Workspace/></Suspense></AppShell></RoleGuard>}

function gb(bytes:number){return (bytes/1024/1024/1024).toFixed(bytes>=1024*1024*1024?2:3)+" GB";}
function mins(seconds:number){return Math.round(Number(seconds||0)/60)+" min";}
function when(value?:string|null){return value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";}
function signalLabel(value:string){const map:any={present:"Present",late:"Late",reconnected:"Reconnected",no_show:"No show",waiting:"Waiting"};return map[value]||value;}
function signalClass(value:string){return value==="present"?"status-active":value==="waiting"||value==="reconnected"?"status-pending":"status-inactive";}

function Workspace(){
 const params=useSearchParams();
 const[tab,setTab]=useState<"overview"|"meetings"|"recordings"|"hosts">("overview");
 const[hosts,setHosts]=useState<Host[]>([]),[meetings,setMeetings]=useState<Meeting[]>([]),[storage,setStorage]=useState<Array<{hostId:string;bytes:number}>>([]);
 const[label,setLabel]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const[showCreate,setShowCreate]=useState(false);
 const[newMeeting,setNewMeeting]=useState({title:"",startAt:"",durationMinutes:60,recording:true,notes:""});

 async function load(){setError("");try{const x=await adminApi("/api/zoom/overview");setHosts(x.hosts||[]);setMeetings(x.meetings||[]);setStorage(x.storageByHost||[])}catch(e){setError(e instanceof Error?e.message:String(e))}}
 async function syncZoom(){setBusy(true);setError("");setNotice("");try{const x=await adminApi("/api/zoom/reconcile",{method:"POST"});setNotice(`Synced with Zoom · ${x.meetingsSynced||0} meetings · ${x.recordingsSynced||0} recording files${x.errors?` · ${x.errors} item(s) need review`:""}`);await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 useEffect(()=>{void load()},[]);
 useLiveRefresh(["zoom_meetings","zoom_recordings","zoom_host_accounts"],load,"admin-zoom");
 useEffect(()=>{if(params.get("connected"))setNotice("Zoom account connected successfully"+(params.get("email")?" · "+params.get("email"):"")+".");if(params.get("zoom_error"))setError(String(params.get("zoom_error")))},[params]);

 const classes=useMemo(()=>meetings.filter(m=>m.purpose==="class"),[meetings]);
 const general=useMemo(()=>meetings.filter(m=>m.purpose==="general"),[meetings]);
 const recordings=useMemo(()=>meetings.flatMap(m=>m.recordings.map(r=>Object.assign({},r,{meeting:m}))).filter((r:any)=>r.status!=="deleted"),[meetings]);
 const active=hosts.filter(h=>h.enabled&&h.status==="connected").length;
 const live=meetings.filter(m=>m.status==="started").length;

 async function connect(){setBusy(true);setError("");try{const next=label.trim()||"Zoom Host "+(hosts.length+1);const x=await adminApi("/api/zoom/connect",{method:"POST",body:JSON.stringify({label:next})});window.location.assign(x.authorizationUrl)}catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false)}}
 async function patchHost(id:string,body:any){setBusy(true);setError("");try{await adminApi("/api/zoom/hosts",{method:"PATCH",body:JSON.stringify(Object.assign({id},body))});await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function createMeeting(){setBusy(true);setError("");try{const body:any={title:newMeeting.title.trim(),durationMinutes:newMeeting.durationMinutes,recording:newMeeting.recording,notes:newMeeting.notes.trim()};if(newMeeting.startAt)body.startAt=new Date(newMeeting.startAt).toISOString();await adminApi("/api/zoom/meetings",{method:"POST",body:JSON.stringify(body)});setNewMeeting({title:"",startAt:"",durationMinutes:60,recording:true,notes:""});setShowCreate(false);setNotice("Meeting created successfully.");await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function cancelMeeting(id:string){if(!window.confirm("Cancel this Zoom meeting?"))return;setBusy(true);try{await adminApi("/api/zoom/meetings",{method:"PATCH",body:JSON.stringify({id,action:"cancel"})});await load()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function recordingAction(id:string,action:string,days?:number){if(action==="delete"&&!window.confirm("Move this recording to Zoom trash?"))return;setBusy(true);setError("");setNotice("");try{await adminApi("/api/zoom/recordings/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({action,days})});await load();setNotice(action==="delete"?"Recording moved to Zoom trash and removed from active list.":action==="toggle-protect"?"Recording protection updated.":action==="toggle-learner"?"Learner recording access updated.":"Recording retention extended.")}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function watchRecording(id:string){window.open("/admin/zoom/recording/"+encodeURIComponent(id),"_blank","noopener,noreferrer")}
 async function copy(value?:string|null){if(!value)return;await navigator.clipboard.writeText(value);setNotice("Guest Zoom link copied.");window.setTimeout(()=>setNotice(""),2000)}

 const tabButton=(id:typeof tab,title:string,count:number)=><button className={tab===id?"button":"button secondary"} onClick={()=>setTab(id)}>{title+" · "+count}</button>;

 return <>
  <AdminPageHeader eyebrow="ONLINE CLASSROOM OPERATIONS" title="Zoom Classroom" description="Run classes, demos and client meetings, manage recordings and control every connected Zoom host from one Robotronix workspace."/>
  {error&&<p className="errorBanner" role="alert">{error}</p>}
  {notice&&<p className="successBanner" role="status">{notice}</p>}

  <section className="experienceKpis">
   <div className="experienceKpi"><span>Connected hosts</span><b>{active}</b><small>Simultaneous Zoom capacity</small></div>
   <div className="experienceKpi"><span>Live now</span><b>{live}</b><small>Meetings currently in progress</small></div>
   <div className="experienceKpi"><span>Classes</span><b>{classes.length}</b><small>Recent provisioned classrooms</small></div>
   <div className="experienceKpi"><span>Recordings ready</span><b>{recordings.filter((r:any)=>r.status==="completed").length}</b><small>Secure Robotronix playback</small></div>
  </section>

  <section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">CONTROL CENTRE</div><h2>Zoom operations</h2><p>Classes stay linked to learners. General meetings are for demos, parents, schools, clients and internal calls.</p></div><div className="row"><button className="button" onClick={()=>{setTab("meetings");setShowCreate(true)}}>+ New Meeting</button><button className="button secondary" disabled={busy} onClick={syncZoom}>{busy?"Syncing…":"Sync with Zoom"}</button></div></div>
   <div className="row" style={{gap:8,flexWrap:"wrap"}}>{tabButton("overview","Classes",classes.length)}{tabButton("meetings","Meetings",general.length)}{tabButton("recordings","Recordings",recordings.length)}{tabButton("hosts","Hosts",hosts.length)}</div>
  </section>

  {tab==="overview"&&<section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">CLASSROOM DELIVERY</div><h2>Recent classes</h2><p>Admin can start any class for support or takeover. Presence is operational evidence, not academic attendance.</p></div></div>
   <div className="tableWrap"><table><thead><tr><th>Class</th><th>Scheduled</th><th>Host</th><th>Status</th><th>Trainer</th><th>Learner</th><th>Recording</th><th>Action</th></tr></thead><tbody>
    {classes.slice(0,60).map(m=><tr key={m.id}><td><b>{m.event?.title||m.topic}</b>{m.presence?.earlyEnd&&<div className="cellSub">Ended earlier than scheduled</div>}</td><td>{when(m.scheduled_start)}</td><td>{m.host?.label||"—"}</td><td><span className={"statusBadge status-"+m.status}>{m.status}</span></td>
     <td><span className={"statusBadge "+signalClass(m.presence?.trainerSignal)}>{signalLabel(m.presence?.trainerSignal)}</span><div className="cellSub">{(m.presence?.trainerConnections||0)+" connection(s) · "+mins(m.presence?.trainerSeconds)}</div></td>
     <td><span className={"statusBadge "+signalClass(m.presence?.learnerSignal)}>{signalLabel(m.presence?.learnerSignal)}</span><div className="cellSub">{(m.presence?.learnerConnections||0)+" connection(s) · "+mins(m.presence?.learnerSeconds)}</div></td>
     <td>{m.recording_enabled?<span className="softBadge">{m.recording_status}</span>:"Off"}</td><td>{["scheduled","started"].includes(m.status)?<a className="button small" href={"/classroom/"+m.event?.id+"?mode=host"} target="_blank" rel="noopener noreferrer">{m.status==="started"?"Join live":"Start class"}</a>:<span className="cellSub">No live action</span>}</td></tr>)}
    {!classes.length&&<tr><td colSpan={8}><div className="emptyState compact">No Zoom classes provisioned yet.</div></td></tr>}
   </tbody></table></div>
  </section>}

  {tab==="meetings"&&<>
   {showCreate&&<section className="dataSection">
    <div className="panelHeader"><div><div className="eyebrow">NEW GENERAL MEETING</div><h2>Create without opening Zoom</h2><p>Robotronix automatically chooses an available host. Share the guest link with anyone you invite.</p></div><button className="button secondary" onClick={()=>setShowCreate(false)}>Close</button></div>
    <div className="formGrid">
     <label>Meeting title<input className="input" value={newMeeting.title} onChange={e=>setNewMeeting(v=>Object.assign({},v,{title:e.target.value}))} placeholder="e.g. Demo with ABC School"/></label>
     <label>Start time (optional)<input className="input" type="datetime-local" value={newMeeting.startAt} onChange={e=>setNewMeeting(v=>Object.assign({},v,{startAt:e.target.value}))}/></label>
     <label>Duration<select className="select" value={newMeeting.durationMinutes} onChange={e=>setNewMeeting(v=>Object.assign({},v,{durationMinutes:Number(e.target.value)}))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option><option value={120}>2 hours</option></select></label>
     <label>Recording<select className="select" value={newMeeting.recording?"yes":"no"} onChange={e=>setNewMeeting(v=>Object.assign({},v,{recording:e.target.value==="yes"}))}><option value="yes">Cloud recording on</option><option value="no">Do not record</option></select></label>
     <label style={{gridColumn:"1 / -1"}}>Notes<input className="input" value={newMeeting.notes} onChange={e=>setNewMeeting(v=>Object.assign({},v,{notes:e.target.value}))} placeholder="Optional internal purpose or context"/></label>
    </div>
    <div className="row topGap"><button className="button" disabled={busy||!newMeeting.title.trim()} onClick={createMeeting}>Create Meeting</button><button className="button secondary" onClick={()=>setShowCreate(false)}>Cancel</button></div>
   </section>}
   <section className="dataSection">
    <div className="panelHeader"><div><div className="eyebrow">DEMOS · CLIENTS · INTERNAL</div><h2>General meetings</h2><p>These meetings do not create learner attendance, progress or payroll records.</p></div><button className="button" onClick={()=>setShowCreate(true)}>+ New Meeting</button></div>
    <div className="tableWrap"><table><thead><tr><th>Meeting</th><th>Scheduled</th><th>Host</th><th>Status</th><th>Recording</th><th>Guest invite</th><th>Actions</th></tr></thead><tbody>
     {general.map(m=><tr key={m.id}><td><b>{m.topic}</b>{m.meeting_notes&&<div className="cellSub">{m.meeting_notes}</div>}</td><td>{when(m.scheduled_start)}</td><td>{m.host?.label||"—"}</td><td><span className={"statusBadge status-"+m.status}>{m.status}</span></td><td>{m.recording_enabled?<span className="softBadge">{m.recording_status}</span>:"Off"}</td>
      <td><button className="button secondary small" disabled={!m.join_url} onClick={()=>copy(m.join_url)}>Copy Link</button>{m.passcode&&<div className="cellSub">Passcode: {m.passcode}</div>}</td>
      <td><div className="row">{["scheduled","started"].includes(m.status)&&<a className="button small" href={"/admin/zoom/meeting/"+m.id} target="_blank" rel="noopener noreferrer">{m.status==="started"?"Join live":"Start"}</a>}{m.status==="scheduled"&&<button className="button secondary small" disabled={busy} onClick={()=>cancelMeeting(m.id)}>Cancel</button>}{!["scheduled","started"].includes(m.status)&&<span className="cellSub">No live action</span>}</div></td></tr>)}
     {!general.length&&<tr><td colSpan={7}><div className="emptyState compact">No general meetings yet.</div></td></tr>}
    </tbody></table></div>
   </section>
  </>}

  {tab==="recordings"&&<section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">SECURE RECORDING LIBRARY</div><h2>Cloud recordings by meeting</h2><p>Expand a meeting to see video, audio and other files. Playback and actions remain restricted to authorized Admin users.</p></div></div>
   {meetings.filter(m=>m.recordings.some(r=>r.status!=="deleted")).map(m=><details key={m.id} className="panel historyPanel">
    <summary style={{cursor:"pointer",display:"flex",gap:16,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
     <span><b>{m.event?.title||m.topic}</b><span className="cellSub">{when(m.scheduled_start)} · {m.purpose==="class"?"Class":m.purpose==="demo"?"Demo":"Meeting"} · {m.host?.label||"Zoom host"}</span></span>
     <span className="softBadge">{m.recordings.filter(r=>r.status!=="deleted").length} files</span>
    </summary>
    <div className="tableWrap topGap"><table><thead><tr><th>File type</th><th>Recorded</th><th>Size</th><th>Retention</th><th>Learner access</th><th>Actions</th></tr></thead><tbody>
    {m.recordings.filter(r=>r.status!=="deleted").map(r=><tr key={r.id}>
     <td>{r.recording_type||r.file_type||"Recording"}</td><td>{when(r.recording_start)}</td><td>{Number(r.file_size_bytes||0)>=1024*1024*1024?gb(Number(r.file_size_bytes||0)):(Number(r.file_size_bytes||0)/1024/1024).toFixed(1)+" MB"}</td>
     <td>{r.protected_from_deletion?<span className="softBadge softGreen">Protected</span>:when(r.retain_until)}</td>
     <td>{m.purpose==="class"?<button className="softBadge" disabled={busy} onClick={()=>recordingAction(r.id,"toggle-learner")}>{r.learner_visible?"Allowed":"Admin only"}</button>:"Admin only"}</td>
     <td><div className="row" style={{flexWrap:"wrap"}}>
      <button className="button small" onClick={()=>watchRecording(r.id)}>Watch</button>
      <button className="button secondary small" disabled={busy} onClick={()=>recordingAction(r.id,"toggle-protect")}>{r.protected_from_deletion?"Unprotect":"Protect"}</button>
      <button className="button secondary small" disabled={busy} onClick={()=>recordingAction(r.id,"extend",60)}>+60 days</button>
      <button className="button secondary small" disabled={busy||r.protected_from_deletion} onClick={()=>recordingAction(r.id,"delete")}>Delete</button>
     </div></td>
    </tr>)}</tbody></table></div>
   </details>)}
   {!recordings.length&&<div className="emptyState compact">No completed recordings yet.</div>}
  </section>}

  {tab==="hosts"&&<section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">HOST POOL</div><h2>Zoom accounts</h2><p>Add independent Zoom accounts as capacity grows. Lower priority numbers are selected first.</p><div className="cellSub">When adding Host 2 or later, first make sure the browser is signed in to that specific Zoom account. While the Zoom app is in Beta Test, that account must also be allowed as a beta/test user in Zoom Marketplace.</div></div></div>
   <div className="row"><input className="input" style={{maxWidth:260}} placeholder={"e.g. Zoom Host "+(hosts.length+1)} value={label} onChange={e=>setLabel(e.target.value)}/><button className="button" disabled={busy} onClick={connect}>+ Add Zoom Account</button></div>
   <div className="tableWrap topGap"><table><thead><tr><th>Host</th><th>Account</th><th>Priority</th><th>Recording</th><th>Retention</th><th>Learner default</th><th>Storage tracked</th><th>Status</th></tr></thead><tbody>
    {hosts.map(h=><HostRow key={h.id} host={h} busy={busy} bytes={storage.find(s=>s.hostId===h.id)?.bytes||0} patch={patchHost}/>)}
    {!hosts.length&&<tr><td colSpan={8}><div className="emptyState compact">No Zoom account connected yet.</div></td></tr>}
   </tbody></table></div>
  </section>}
 </>;
}

function HostRow({host:h,busy,bytes,patch}:{host:Host;busy:boolean;bytes:number;patch:(id:string,body:any)=>Promise<void>}){
 const[p,setP]=useState(String(h.priority));useEffect(()=>setP(String(h.priority)),[h.priority]);
 return <tr><td><b>{h.label}</b><div className="cellSub">{h.enabled?"Enabled":"Disabled"}</div></td><td>{h.zoomEmail||"Zoom account"}<div className="cellSub">{h.lastSyncAt?"Synced "+when(h.lastSyncAt):"Not synced yet"}</div></td>
  <td><input className="input" type="number" min={1} max={9999} style={{width:90}} value={p} disabled={busy} onChange={e=>setP(e.target.value)} onBlur={()=>{const n=Number(p)||100;if(n!==h.priority)patch(h.id,{priority:n})}}/></td>
  <td><button className={"softBadge "+(h.recordingEnabled?"softGreen":"")} disabled={busy} onClick={()=>patch(h.id,{recordingEnabled:!h.recordingEnabled})}>{h.recordingEnabled?"Cloud recording ON":"Recording OFF"}</button></td>
  <td><select className="select" value={h.recordingRetentionDays} disabled={busy} onChange={e=>patch(h.id,{recordingRetentionDays:Number(e.target.value)})}><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option></select></td>
  <td><button className="softBadge" disabled={busy} onClick={()=>patch(h.id,{learnerRecordingDefault:!h.learnerRecordingDefault})}>{h.learnerRecordingDefault?"Visible":"Admin only"}</button></td>
  <td>{gb(bytes)}</td><td><button className={"statusBadge status-"+(h.enabled?"active":"inactive")} disabled={busy} onClick={()=>patch(h.id,{enabled:!h.enabled})}>{h.enabled?"Active":"Disabled"}</button></td></tr>;
}
