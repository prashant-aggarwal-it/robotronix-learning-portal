"use client";
import {GridReset} from "@/components/admin/GridFilterControls";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Row={id:string;occurred_at:string;level:string;source:string;action:string;reference_id:string;error_code:string|null;safe_message:string};
const JOB_INTERVAL_MINUTES:Record<string,number>={"process-reminders":5,"zoom-retention":1440,"zoom-auto-reconcile":5,"system-log-retention":1440};
type Job={id:string;job_name:string;started_at:string;status:string;processed:number;succeeded:number;failed:number;duration_ms:number|null;reference_id:string};
type AlertDelivery={id:string;category:string;status:string;created_at:string;reference_id:string;failure_code:string|null};
const EXPECTED_JOBS=Object.keys(JOB_INTERVAL_MINUTES);
export default function SystemLogs(){
 const [jobs,setJobs]=useState<Job[]>([]),[historyAvailable,setHistoryAvailable]=useState(true);
 const [alerts,setAlerts]=useState<AlertDelivery[]>([]),[alertHistoryAvailable,setAlertHistoryAvailable]=useState(true);
 const[rows,setRows]=useState<Row[]>([]),[level,setLevel]=useState(""),[q,setQ]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function load(levelOverride=level,queryOverride=q){
  setBusy(true);setError("");
  try{
   const supabase=getSupabaseBrowserClient();
   const session=supabase?(await supabase.auth.getSession()).data.session:null;
   if(!session){setError("Sign in as an administrator to view system logs.");return;}
   const params=new URLSearchParams({level:levelOverride,q:queryOverride});
   const response=await fetch("/api/admin/system-logs?"+params.toString(),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   if(!response.ok){setError(response.status===403?"Admin access required.":"System logs unavailable.");return;}
   const result=await response.json();
   setRows(Array.isArray(result.rows)?result.rows:[]);
   setJobs(Array.isArray(result.jobs)?result.jobs:[]);
   setHistoryAvailable(result.jobHistoryAvailable!==false);
   setAlerts(Array.isArray(result.alerts)?result.alerts:[]);
   setAlertHistoryAvailable(result.alertHistoryAvailable!==false);
  }catch{setError("Unable to load system logs. Try again.");}finally{setBusy(false);}
 }
 useEffect(()=>{void load()},[level]);
 return <RoleGuard allow={["admin"]}><AppShell role="admin"><section className="panel">
  <div className="panelHeader"><div><h1>System Logs</h1><p>Recorded operational issues and significant job activity. Routine successful runs are intentionally omitted. Sensitive customer, authentication and payout data is not displayed.</p></div><button className="button ghost" onClick={()=>void load()} disabled={busy}>{busy?"Loading…":"Refresh"}</button></div>
  <div className="formGrid"><label>Severity<select className="input" value={level} onChange={e=>setLevel(e.target.value)}><option value="">All</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Information</option></select></label><label>Source or reference<input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search source or reference ID"/></label></div>
  <button className="button secondary" onClick={()=>void load()} disabled={busy}>Search</button><GridReset changed={Boolean(level||q)} onReset={()=>{setLevel("");setQ("");void load("","")}}/>
  {error&&<div role="alert" className="errorBanner">{error}</div>}
  <div style={{marginTop:20}}><h2>Background job health</h2><p>Recent recorded executions. An overdue or missing heartbeat needs investigation; empty history does not mean the job is healthy.</p>{!historyAvailable&&<div role="alert" className="errorBanner">Job history database module is not installed in this environment.</div>}<div style={{overflowX:"auto"}}><table style={{width:"100%"}}><thead><tr><th>Job</th><th>Last run</th><th>Status</th><th>Processed</th><th>Succeeded</th><th>Failed</th><th>Duration</th></tr></thead><tbody>{EXPECTED_JOBS.map(name=>{const j=jobs.find(run=>run.job_name===name);const overdue=!j||Date.now()-new Date(j.started_at).getTime()>JOB_INTERVAL_MINUTES[name]*3*60000;return <tr key={name}><td>{name}</td><td>{j?new Date(j.started_at).toLocaleString("en-IN"):"Never recorded"}</td><td style={{color:overdue||j?.status!=="success"?"#b42318":undefined,fontWeight:overdue?700:undefined}}>{!j?"Missing heartbeat":overdue?"Overdue · "+j.status:j.status}</td><td>{j?.processed??"—"}</td><td>{j?.succeeded??"—"}</td><td>{j?.failed??"—"}</td><td>{j?.duration_ms??"—"} ms</td></tr>})}</tbody></table>{!jobs.length&&historyAvailable&&<p>No job executions recorded yet. Confirm scheduled functions are configured and can write job history.</p>}</div></div>
  <h2 style={{marginTop:24}}>Critical email alert delivery</h2>
  {!alertHistoryAvailable?<p>Alert delivery history is not installed yet. Apply the operational logging SQL module in DEV before enabling email alerts.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%"}}><thead><tr><th>Time</th><th>Category</th><th>Delivery status</th><th>Reference</th></tr></thead><tbody>{alerts.slice(0,20).map(a=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString("en-IN")}</td><td>{a.category}</td><td style={{color:a.status==="failed"?"#b42318":undefined}}>{a.status}{a.failure_code?" · "+a.failure_code:""}</td><td><code>{a.reference_id}</code></td></tr>)}</tbody></table>{!alerts.length&&<p>No email alerts have been dispatched. Email delivery stays disabled until a verified sender, recipient and API key are configured.</p>}</div>}
  <h2 style={{marginTop:24}}>Operational events</h2>
  <div style={{overflowX:"auto",marginTop:16}}><table style={{width:"100%"}}><thead><tr><th>Time</th><th>Severity</th><th>Source / action</th><th>Safe description</th><th>Reference</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.id}><td>{new Date(r.occurred_at).toLocaleString("en-IN")}</td><td>{r.level}</td><td>{r.source} / {r.action}</td><td>{r.safe_message}{r.error_code?" ("+r.error_code+")":""}</td><td><code>{r.reference_id}</code></td></tr>)}
  </tbody></table>{!rows.length&&!busy&&!error&&<p>No recorded events match these filters. This does not confirm that all background jobs or integrations are healthy; check the relevant job execution logs for routine heartbeat information.</p>}</div>
 </section></AppShell></RoleGuard>;
}
