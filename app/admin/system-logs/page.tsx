"use client";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Row={id:string;occurred_at:string;level:string;source:string;action:string;reference_id:string;error_code:string|null;safe_message:string;fingerprint:string};
type Job={id:string;job_name:string;started_at:string;status:string;processed:number;succeeded:number;failed:number;duration_ms:number|null;reference_id:string};
type Alert={id:string;category:string;status:string;created_at:string;reference_id:string;failure_code:string|null};
type Issue={fingerprint:string;status:string;note:string;updated_at:string};
type Group={fingerprint:string;source:string;action:string;error_code:string|null;count:number;lastSeen:string};
type Result={rows:Row[];total:number;page:number;pageSize:number;jobs:Job[];alerts:Alert[];issues:Issue[];groups:Group[];sources:string[];jobHistoryAvailable:boolean;alertHistoryAvailable:boolean;issueTrackingAvailable:boolean;metrics:{errors24h:number;warnings24h:number;countsCapped:boolean}};
const intervals:Record<string,number>={"process-reminders":5,"zoom-retention":1440,"zoom-auto-reconcile":5,"system-log-retention":1440};
const format=(s:string)=>new Date(s).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
const diagnostic=(code:string|null)=>{if(!code)return{stage:"Not captured",http:"Not captured"};const http=code.match(/_HTTP_(\d{3})$/)?.[1]||"Not captured";const stage=code.includes("REFRESH_URL")?"Zoom recording URL refresh":code.includes("ZOOM_TRASH")?"Zoom cloud recording Trash":code.includes("STREAM")?"Recording streaming":code.includes("OAUTH")?"Zoom authorization":"See error code";return{stage,http};};
export default function SystemLogs(){
 const[data,setData]=useState<Result|null>(null),[level,setLevel]=useState(""),[q,setQ]=useState(""),[source,setSource]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[page,setPage]=useState(1);
 const[expanded,setExpanded]=useState(""),[grouped,setGrouped]=useState(false),[statusFilter,setStatusFilter]=useState(""),[status,setStatus]=useState(""),[note,setNote]=useState("");
 const[error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false);
 async function session(){const client=getSupabaseBrowserClient();const s=client?(await client.auth.getSession()).data.session:null;if(!s)throw new Error("Sign in as an administrator.");return s;}
 async function load(nextPage=page,overrides?:{level?:string;source?:string;q?:string;from?:string;to?:string}){
  setBusy(true);setError("");
  try{
   const s=await session(),filters={level,source,q,from,to,...overrides};
   const params=new URLSearchParams({...filters,page:String(nextPage)});
   const response=await fetch("/api/admin/system-logs?"+params,{headers:{Authorization:"Bearer "+s.access_token},cache:"no-store"});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||"Unable to read system logs");
   setData(body);setPage(nextPage);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load system logs");}
  finally{setBusy(false);}
 }
 useEffect(()=>{void load(1)},[]);
 const latest=useMemo(()=>Object.keys(intervals).map(name=>{const job=data?.jobs.find(j=>j.job_name===name),minutes=intervals[name];const delay=job?Date.now()-new Date(job.started_at).getTime():Infinity;const overdue=delay>minutes*3*60000;return{name,job,minutes,overdue,delay};}),[data]);
 const activeIssues=latest.filter(j=>j.overdue||j.job?.status!=="success").length;
 const selected=data?.rows.find(r=>r.id===expanded),selectedGroup=data?.groups.find(g=>g.fingerprint===expanded);
 const selectedKey=selected?.fingerprint||selectedGroup?.fingerprint;
 const issue=data?.issues.find(i=>i.fingerprint===selectedKey);
 function expand(id:string,fingerprint:string){setExpanded(v=>v===id?"":id);const i=data?.issues.find(x=>x.fingerprint===fingerprint);setStatus(i?.status||"open");setNote(i?.note||"");}
 async function saveIssue(){
  if(!selectedKey)return;setSaving(true);setError("");setSuccess("");
  try{const s=await session();const response=await fetch("/api/admin/system-logs",{method:"PATCH",headers:{Authorization:"Bearer "+s.access_token,"Content-Type":"application/json"},body:JSON.stringify({fingerprint:selectedKey,status,note})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to save issue");setSuccess("Issue status saved.");await load();}
  catch(e){setError(e instanceof Error?e.message:"Unable to save issue");}finally{setSaving(false);}
 }
 function exportCsv(){if(!data)return;const fields=["occurred_at","level","source","action","error_code","safe_message","reference_id"] as const;const lines=[fields.join(","),...data.rows.map(row=>fields.map(f=>'"'+String(row[f]??"").replaceAll('"','""')+'"').join(","))];const blob=new Blob([lines.join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="robotronix-system-logs-page-"+page+".csv";a.click();URL.revokeObjectURL(url);}
 return <RoleGuard allow={["admin"]}><AppShell role="admin"><section className="panel">
 <div className="panelHeader"><div><div className="eyebrow">OPERATIONS / MONITORING</div><h1>System Logs</h1><p>Investigate safe operational errors, jobs and delivery. Raw credentials and customer data are not displayed.</p></div><div className="row" style={{gap:8,flexWrap:"wrap"}}><button className="button ghost" disabled={busy} onClick={()=>void load()}>{busy?"Loading…":"Refresh"}</button><button className="button secondary" onClick={exportCsv} disabled={!data?.rows.length}>Export page CSV</button></div></div>
 <div className="financeSummaryGrid" style={{marginBottom:16}}>
 <div><span>Errors · 24h</span><b>{data?.metrics.errors24h??"—"}</b></div>
 <div><span>Warnings · 24h</span><b>{data?.metrics.warnings24h??"—"}</b></div>
 <div><span>Jobs needing attention</span><b>{data?activeIssues:"—"}</b></div>
 <div><span>Email delivery</span><b>{!data?"—":!data.alertHistoryAvailable?"Unavailable":data.alerts.length?data.alerts[0].status:"Not configured / no dispatch"}</b></div>
 </div>
 {data?.metrics.countsCapped&&<p className="fieldHint">24-hour counts include the latest 2,000 events; older events in that window are excluded.</p>}
 <div className="formGrid"><label>Severity<select className="input" value={level} onChange={e=>setLevel(e.target.value)}><option value="">All</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Information</option></select></label>
 <label>Module<select className="input" value={source} onChange={e=>setSource(e.target.value)}><option value="">All sources</option>{data?.sources.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
 <label>Source, code or reference<input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Find reference ID or error code"/></label>
 <label>From (UTC)<input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
 <label>To (UTC)<input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
 <div className="formActions"><button className="button secondary" disabled={busy} onClick={()=>void load(1)}>Search</button><button className="button ghost" disabled={busy} onClick={()=>{setLevel("");setSource("");setQ("");setFrom("");setTo("");void load(1,{level:"",source:"",q:"",from:"",to:""})}}>Reset</button></div>
 {error&&<div className="errorBanner" role="alert">{error}</div>}{success&&<div className="successBanner" role="status">{success}</div>}
 <h2 style={{marginTop:20}}>Operational events</h2>
 <div className="row" style={{gap:12,alignItems:"center",flexWrap:"wrap"}}><label className="row" style={{gap:6}}><input type="checkbox" checked={grouped} onChange={e=>{setGrouped(e.target.checked);setExpanded("")}}/>Group repeated errors (24h)</label><small className="fieldHint">{grouped?"Grouped from latest 2,000 events in 24h":(data?.total??0)+" matching events · 25 per page"}</small>{grouped&&<label>Issue status <select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option></select></label>}</div>
 <div className="tableWrap professionalTable"><table><thead><tr><th>{grouped?"Last seen":"Time"}</th><th>Severity / issue</th><th>Source / action</th><th>Safe description</th><th>{grouped?"Count":"Reference"}</th></tr></thead><tbody>
 {grouped?(data?.groups||[]).filter(g=>!statusFilter||(data?.issues.find(i=>i.fingerprint===g.fingerprint)?.status||"open")===statusFilter).map(g=><tr key={g.fingerprint} onClick={()=>expand(g.fingerprint,g.fingerprint)} style={{cursor:"pointer",background:expanded===g.fingerprint?"var(--surface-muted, #f1f5f9)":undefined}}><td>{format(g.lastSeen)}</td><td><span className="softBadge softAmber">{data?.issues.find(i=>i.fingerprint===g.fingerprint)?.status||"open"}</span></td><td>{g.source} / {g.action}</td><td>{g.error_code||"Unspecified issue"}</td><td>{g.count}</td></tr>):(data?.rows||[]).map(r=><tr key={r.id} onClick={()=>expand(r.id,r.fingerprint)} style={{cursor:"pointer",background:expanded===r.id?"var(--surface-muted, #f1f5f9)":undefined}}><td>{format(r.occurred_at)}</td><td>{r.level}</td><td>{r.source} / {r.action}</td><td>{r.safe_message}<div className="cellSub">{r.error_code||""}</div></td><td><code>{r.reference_id}</code></td></tr>)}
 </tbody></table></div>
 {selectedKey&&<section className="panel" aria-label="Selected issue details" style={{marginTop:12,padding:16,border:"1px solid #cbd5e1"}}><div className="panelHeader"><div><h3>Issue details</h3><p>Safe technical context and administrator investigation status</p></div><button className="button ghost smallButton" onClick={()=>setExpanded("")}>Close</button></div>
 <div className="summaryDefinitionGrid"><div><span>Module</span><b>{selected?.source||selectedGroup?.source}</b></div><div><span>Action</span><b>{selected?.action||selectedGroup?.action}</b></div><div><span>Error code</span><b>{selected?.error_code||selectedGroup?.error_code||"Not recorded"}</b></div><div><span>Failure stage</span><b>{diagnostic(selected?.error_code||selectedGroup?.error_code||null).stage}</b></div><div><span>Upstream HTTP status</span><b>{diagnostic(selected?.error_code||selectedGroup?.error_code||null).http}</b></div><div><span>First/last shown</span><b>{selected?format(selected.occurred_at):selectedGroup?format(selectedGroup.lastSeen):"—"}</b></div></div>
 {selected&&<p className="fieldHint">Reference: <code>{selected.reference_id}</code> <button className="button ghost smallButton" onClick={()=>void navigator.clipboard.writeText(selected.reference_id)}>Copy reference</button></p>}
 {selected?.source==="zoom-recording"||selectedGroup?.source==="zoom-recording"?<div className="infoBanner">Inspect the connected Zoom host, granted OAuth scopes, meeting-instance UUID and authorized recording metadata. Confirm provider status in server logs before changing configuration.</div>:null}
 {!data?.issueTrackingAvailable?<div className="infoBanner">Issue tracking is not installed. Apply the additive operational-issues migration before managing issue status.</div>:<div className="formGrid"><label>Issue status<select className="input" value={status} onChange={e=>setStatus(e.target.value)}><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option></select></label><label>Internal note (max 500 characters)<input className="input" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Safe investigation note; no personal data"/></label><div><button className="button secondary" disabled={saving} onClick={()=>void saveIssue()}>{saving?"Saving…":"Save issue status"}</button></div></div>}
 {issue?.updated_at&&<p className="fieldHint">Last reviewed: {format(issue.updated_at)}</p>}</section>}
 {!grouped&&<div className="formActions"><button className="button ghost" disabled={busy||page<=1} onClick={()=>void load(page-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil((data?.total||0)/25))}</span><button className="button ghost" disabled={busy||page*25>=(data?.total||0)} onClick={()=>void load(page+1)}>Next</button></div>}
 <h2 style={{marginTop:22}}>Background job health</h2><p className="fieldHint">A missing heartbeat can indicate missing scheduling or instrumentation. Never assume success from empty history.</p>
 {!data?.jobHistoryAvailable&&<div className="errorBanner">Job execution history unavailable.</div>}
 <div className="tableWrap"><table className="table"><thead><tr><th>Job</th><th>Last run</th><th>Expected frequency</th><th>Next expected</th><th>Status</th><th>Processed / failed</th></tr></thead><tbody>{latest.map(j=><tr key={j.name}><td>{j.name}</td><td>{j.job?format(j.job.started_at):"Never recorded"}</td><td>{j.minutes===1440?"Daily":"Every 5 min"}</td><td>{j.job?format(new Date(new Date(j.job.started_at).getTime()+j.minutes*60000).toISOString()):"Unknown"}</td><td style={{color:j.overdue?"#b42318":undefined}}>{!j.job?"Missing heartbeat":j.overdue?"Overdue":j.job.status}</td><td>{j.job?j.job.processed+" / "+j.job.failed:"—"}</td></tr>)}</tbody></table></div>
 <p className="fieldHint">If <b>system-log-retention</b> is missing, inspect the scheduled function and its write permissions. A job can exist without instrumentation; do not run destructive retention manually on Production.</p>
 <h2 style={{marginTop:22}}>Critical email alert delivery</h2>
 {!data?.alertHistoryAvailable?<p>Alert history unavailable.</p>:<div className="tableWrap"><table className="table"><thead><tr><th>Time</th><th>Category</th><th>Status</th><th>Reference</th></tr></thead><tbody>{(data?.alerts||[]).slice(0,20).map(a=><tr key={a.id}><td>{format(a.created_at)}</td><td>{a.category}</td><td>{a.status}{a.failure_code?" · "+a.failure_code:""}</td><td><code>{a.reference_id}</code></td></tr>)}</tbody></table>{!data?.alerts.length&&<p>No email delivery attempts recorded. A verified sender, recipient and provider API key must be configured before alerts can be dispatched.</p>}</div>}
 </section></AppShell></RoleGuard>;
}
