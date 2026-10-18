"use client";
import Link from "next/link";
import {Suspense,useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {adminApi} from "@/lib/admin-api-client";

type Host={id:string;label:string;zoomEmail:string;status:string;connectedAt:string;lastSyncAt:string|null};
type Meeting={id:string;topic:string;scheduledStart:string;zoomMeetingId:string};
export default function ZoomTest(){return <RoleGuard allow={["admin"]}><AppShell role="admin"><Suspense fallback={<p>Loading Zoom test…</p>}><Workspace/></Suspense></AppShell></RoleGuard>}
function Workspace(){
 const search=useSearchParams();const [hosts,setHosts]=useState<Host[]>([]),[selected,setSelected]=useState(""),[meeting,setMeeting]=useState<Meeting|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=async()=>{try{const data=await adminApi("/api/zoom/hosts");setHosts(data.hosts||[]);if(!selected&&data.hosts?.[0])setSelected(data.hosts[0].id)}catch(e){setError(e instanceof Error?e.message:String(e))}};
 async function connect(){setBusy(true);setError("");try{const data=await adminApi("/api/zoom/connect",{method:"POST",body:JSON.stringify({label:"Zoom Host 1"})});window.location.assign(data.authorizationUrl)}catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false)}}
 useEffect(()=>{load()},[]);
 async function createMeeting(){setBusy(true);setError("");try{const data=await adminApi("/api/zoom/test-meeting",{method:"POST",body:JSON.stringify({hostId:selected})});setMeeting(data.meeting)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function cancel(){if(!meeting)return;setBusy(true);setError("");try{await adminApi(`/api/zoom/test-meeting?id=${encodeURIComponent(meeting.id)}`,{method:"DELETE"});setMeeting(null)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const oauthError=search.get("zoom_error");
 return <>
  <AdminPageHeader eyebrow="ZOOM PROOF OF CONCEPT" title="Robotronix Classroom · Zoom 1" description="Isolated test only. This page does not change normal class scheduling yet."/>
  {(oauthError||error)&&<p className="errorBanner" role="alert">{oauthError||error}</p>}
  {search.get("connected")==="1"&&<p className="successBanner" role="status">Zoom authorization saved successfully{search.get("email")?` for ${search.get("email")}`:""}.</p>}
  <section className="dataSection"><h2>1. Connect a Zoom host</h2><p>Connect one licensed Zoom account first. Robotronix stores OAuth tokens encrypted on the server; trainers never receive the Zoom password.</p><button className="button" disabled={busy} onClick={connect}>Connect / reconnect Zoom Host 1</button><button className="button secondary" disabled={busy} onClick={load}>Refresh status</button></section>
  <section className="dataSection"><h2>2. Connected hosts</h2>{hosts.length?<div className="tableWrap"><table><thead><tr><th>Use</th><th>Label</th><th>Zoom account</th><th>Status</th><th>Last sync</th></tr></thead><tbody>{hosts.map(h=><tr key={h.id}><td><input aria-label={`Select ${h.label}`} type="radio" checked={selected===h.id} onChange={()=>setSelected(h.id)}/></td><td><b>{h.label}</b></td><td>{h.zoomEmail||"Connected Zoom user"}</td><td>{h.status}</td><td>{h.lastSyncAt?new Date(h.lastSyncAt).toLocaleString():"—"}</td></tr>)}</tbody></table></div>:<p>No Zoom account has been captured by the portal yet. After deploying this POC, click Connect / reconnect and authorize Zoom again.</p>}</section>
  <section className="dataSection"><h2>3. Create one test meeting</h2><button className="button" disabled={!selected||busy} onClick={createMeeting}>{busy?"Working…":"Create 30-minute test meeting"}</button>{meeting&&<div className="topGap"><p><b>{meeting.topic}</b><br/>Zoom meeting: {meeting.zoomMeetingId}<br/>Scheduled: {new Date(meeting.scheduledStart).toLocaleString()}</p><div className="row"><Link className="button" href={`/zoom-poc/classroom?meeting=${encodeURIComponent(meeting.id)}&mode=host`}>Start as Trainer</Link><Link className="button secondary" href={`/zoom-poc/classroom?meeting=${encodeURIComponent(meeting.id)}&mode=participant`}>Join as Participant</Link><button className="button ghost" disabled={busy} onClick={cancel}>Cancel test meeting</button></div><p><small>For the real proof, open “Start as Trainer” while signed in as Admin/Trainer, and “Join as Participant” in another browser profile signed in as the QA Student.</small></p></div>}</section>
  <section className="dataSection"><h2>What this POC proves</h2><p>OAuth connection → Robotronix creates a Zoom meeting → host starts it using a fresh ZAK token → participant joins through the embedded Web Meeting SDK. It does not yet assign Zoom hosts to real scheduled classes or record attendance.</p></section>
 </>
}
