"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Incident={id:string;title:string;fingerprint:string;category:string;severity:string;status:string;occurrences:number;last_seen_at:string};
type Audit={incident_id:string;action:string;occurred_at:string};
export default function PlatformIncidents(){
 const [incidents,setIncidents]=useState<Incident[]>([]),[audit,setAudit]=useState<Audit[]>([]);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const [form,setForm]=useState({title:"",fingerprint:"",category:"other",severity:"warning"});
 async function request(action:"create"|"acknowledge"|"resolve",id?:string){
  setBusy(true);setError("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const payload=action==="create"?{action,...form}:{action,id};
   const res=await fetch("/api/platform-admin/incidents",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify(payload)});
   const body=await res.json();if(!res.ok||!body.ok)throw Error(body.error||"Incident update unavailable");
   if(action==="create")setForm({title:"",fingerprint:"",category:"other",severity:"warning"});
   setRevision(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Incident update unavailable");}finally{setBusy(false);}
 }
 useEffect(()=>{let alive=true;(async()=>{
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in first");
  const res=await fetch("/api/platform-admin/incidents",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await res.json();if(!res.ok||!body.ok)throw Error(body.error||"Incidents unavailable");
  if(alive){setIncidents(body.incidents||[]);setAudit(body.history||[]);setError("");}
 })().catch(e=>{if(alive)setError(e instanceof Error?e.message:"Incidents unavailable")});
 return()=>{alive=false};},[revision]);
 return <section className="platformPanel platformMonitorTile" aria-label="Incident management">
  <h3>Security, incidents & alerts</h3><p>Read-only incident monitoring with deliberate manual acknowledgement and resolution. Automated notifications are not configured.</p>
  <div className="platformMonitorTiles">
   {(["critical","warning","info"] as const).map(severity=><div key={severity} style={{padding:14,border:"1px solid #e4ddeb",borderRadius:10}}><strong>{incidents.filter(i=>i.severity===severity&&i.status!=="resolved").length}</strong><p>{severity} open or acknowledged</p></div>)}
  </div>
  {error&&<p role="alert">{error}</p>}
  <h4>Record an incident</h4>
  <form onSubmit={e=>{e.preventDefault();void request("create");}} style={{display:"grid",gap:10,maxWidth:560}}>
   <label>Title<input required minLength={5} maxLength={120} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
   <label>Deduplication key (lowercase letters, numbers, _, :, -)<input required minLength={8} maxLength={100} pattern="[a-z0-9_:\-]+" value={form.fingerprint} onChange={e=>setForm(v=>({...v,fingerprint:e.target.value}))}/></label>
   <label>Category<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{["security","email","worker","api","billing","integration","other"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <label>Severity<select value={form.severity} onChange={e=>setForm(v=>({...v,severity:e.target.value}))}>{["critical","warning","info"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <button type="submit" disabled={busy}>Record incident</button>
  </form>
  <h4>Recent incidents</h4>
  {incidents.length===0&&<p>No incidents recorded. This does not establish that the platform has no errors.</p>}
  <div className="platformTableScroll"><table><thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Occurrences</th><th>Last seen</th><th>Action</th></tr></thead><tbody>
   {incidents.map(i=><tr key={i.id}><td>{i.title}<small style={{display:"block"}}>{i.category} · {i.fingerprint}</small></td><td>{i.severity}</td><td>{i.status}</td><td>{i.occurrences}</td><td>{new Date(i.last_seen_at).toLocaleString()}</td>
   <td>{i.status!=="resolved"&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{i.status==="open"&&<button type="button" disabled={busy} onClick={()=>void request("acknowledge",i.id)}>Acknowledge</button>}<button type="button" disabled={busy} onClick={()=>{if(window.confirm("Resolve this incident? Its audit history will be retained."))void request("resolve",i.id);}}>Resolve</button></div>}</td></tr>)}
  </tbody></table></div>
  <h4>Recent incident history</h4>
  <div className="platformTableScroll"><table><thead><tr><th>Incident ID</th><th>Event</th><th>When</th></tr></thead><tbody>{audit.map((a,i)=><tr key={i}><td>{a.incident_id}</td><td>{a.action}</td><td>{new Date(a.occurred_at).toLocaleString()}</td></tr>)}</tbody></table></div>
  <p>Showing the 100 most recent records. Incident notifications and automated detection are not yet configured.</p>
 </section>;
}
