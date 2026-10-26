"use client";
import {GridReset} from "@/components/admin/GridFilterControls";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Row={id:string;occurred_at:string;level:string;source:string;action:string;reference_id:string;error_code:string|null;safe_message:string};
export default function SystemLogs(){
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
  }catch{setError("Unable to load system logs. Try again.");}finally{setBusy(false);}
 }
 useEffect(()=>{void load()},[level]);
 return <RoleGuard allow={["admin"]}><AppShell role="admin"><section className="panel">
  <div className="panelHeader"><div><h1>System Logs</h1><p>Recorded operational issues and significant job activity. Routine successful runs are intentionally omitted. Sensitive customer, authentication and payout data is not displayed.</p></div><button className="button ghost" onClick={()=>void load()} disabled={busy}>{busy?"Loading…":"Refresh"}</button></div>
  <div className="formGrid"><label>Severity<select className="input" value={level} onChange={e=>setLevel(e.target.value)}><option value="">All</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Information</option></select></label><label>Source or reference<input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search source or reference ID"/></label></div>
  <button className="button secondary" onClick={()=>void load()} disabled={busy}>Search</button><GridReset changed={Boolean(level||q)} onReset={()=>{setLevel("");setQ("");void load("","")}}/>
  {error&&<div role="alert" className="errorBanner">{error}</div>}
  <div style={{overflowX:"auto",marginTop:16}}><table style={{width:"100%"}}><thead><tr><th>Time</th><th>Severity</th><th>Source / action</th><th>Safe description</th><th>Reference</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.id}><td>{new Date(r.occurred_at).toLocaleString("en-IN")}</td><td>{r.level}</td><td>{r.source} / {r.action}</td><td>{r.safe_message}{r.error_code?" ("+r.error_code+")":""}</td><td><code>{r.reference_id}</code></td></tr>)}
  </tbody></table>{!rows.length&&!busy&&!error&&<p>No recorded events match these filters. This does not confirm that all background jobs or integrations are healthy; check the relevant job execution logs for routine heartbeat information.</p>}</div>
 </section></AppShell></RoleGuard>;
}
