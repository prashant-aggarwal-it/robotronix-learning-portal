"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {KpiCard} from "@/components/admin/KpiCard";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {listReminderPolicies,saveReminderPolicy} from "@/lib/repository";
import type {ReminderPolicy} from "@/lib/types";
type RowState={state:"clean"|"dirty"|"saving"|"saved"|"error";message?:string};
type Health={checkedAt:string;processorStatus:string;lastRun:{started_at:string;status:string;processed:number;succeeded:number;failed:number}|null;lastSuccessAt:string|null;runs24h:number;failures24h:number;generated24h:number;recent:{id:string;at:string;recipientRole:string;read:boolean}[];note:string};
const defaults:Record<string,number>={"rem-parent-30":30,"rem-student-15":15,"rem-trainer-30":30,"rem-trainer-10":10,"rem-trainer-update-30":30};
function label(role:string){return role.charAt(0).toUpperCase()+role.slice(1)}
const fmt=(date:string)=>new Date(date).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
export default function ReminderSettings(){
 const[rows,setRows]=useState<ReminderPolicy[]>([]),[states,setStates]=useState<Record<string,RowState>>({});
 const[loading,setLoading]=useState(true),[error,setError]=useState(""),[healthError,setHealthError]=useState(""),[health,setHealth]=useState<Health|null>(null);
 const[testing,setTesting]=useState(false),[testNotice,setTestNotice]=useState("");
 const busy=useRef(new Set<string>()),current=useRef<ReminderPolicy[]>([]);
 function publish(next:ReminderPolicy[]){current.current=next;setRows(next);}
 const getToken=async()=>{const client=getSupabaseBrowserClient();const session=client?(await client.auth.getSession()).data.session:null;if(!session)throw Error("Administrator session expired.");return session.access_token;};
 const loadHealth=useCallback(async()=>{try{const token=await getToken();const res=await fetch("/api/admin/reminder-health",{headers:{Authorization:"Bearer "+token},cache:"no-store"});const data=await res.json();if(!res.ok)throw Error(data.error||"Unavailable");setHealth(data);setHealthError("");}catch{setHealthError("Unable to retrieve processing health. Check System Logs.");}},[]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{const data=await listReminderPolicies();publish(data);setStates(Object.fromEntries(data.map(r=>[r.id,{state:"clean" as const}])));}
  catch(e){setError(e instanceof Error?e.message:"Unable to load reminder rules.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();void loadHealth()},[refresh,loadHealth]);
 function local(id:string,patch:Partial<ReminderPolicy>){publish(current.current.map(r=>r.id===id?{...r,...patch}:r));setStates(s=>({...s,[id]:{state:"dirty"}}));}
 async function save(id:string,patch:Partial<ReminderPolicy>){
  if(busy.current.has(id))return;
  busy.current.add(id);setStates(s=>({...s,[id]:{state:"saving"}}));
  try{
   const result=await saveReminderPolicy(id,patch);
   if(!result.ok){setStates(s=>({...s,[id]:{state:"error",message:result.error||"Unable to save"}}));return;}
   // Read the persisted policy after each save; don't mark unsaved local data as saved.
   const refreshed=await listReminderPolicies();
   const latest=refreshed.find(x=>x.id===id);
   if(!latest)throw Error("The saved policy could not be verified.");
   publish(current.current.map(row=>row.id===id?latest:row));
   setStates(s=>({...s,[id]:{state:"saved",message:"Saved "+new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}}));
  }catch(e){setStates(s=>({...s,[id]:{state:"error",message:e instanceof Error?e.message:"Unable to verify save"}}));}
  finally{busy.current.delete(id);}
 }
 function timing(row:ReminderPolicy){
  const after=row.eventType==="attendance_pending",value=after?row.minutesAfter:row.minutesBefore,limit=after?240:1440;
  if(value===undefined||!Number.isInteger(value)||value<5||value>limit){
   setStates(s=>({...s,[row.id]:{state:"error",message:"Use a whole number between 5 and "+limit+" minutes."}}));return;
  }
  void save(row.id,after?{minutesAfter:value}:{minutesBefore:value});
 }
 async function test(){
  setTesting(true);setTestNotice("");
  try{
   const token=await getToken(),response=await fetch("/api/admin/reminder-health",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"self-test"})});
   const body=await response.json();if(!response.ok)throw Error(body.error||"Test failed");
   setTestNotice("Test notification created for your Admin account. Check Notifications in the top bar.");
  }catch(e){setTestNotice(e instanceof Error?e.message:"Unable to send test notification.");}
  finally{setTesting(false);}
 }
 async function reset(){
  if(!window.confirm("Restore the standard timing defaults? Existing enabled/disabled choices will remain unchanged."))return;
  for(const row of current.current){const n=defaults[row.id];if(n===undefined)continue;await save(row.id,row.eventType==="attendance_pending"?{minutesAfter:n}:{minutesBefore:n});}
 }
 const locked=loading||busy.current.size>0;
 return <RoleGuard allow={["admin"]}><AppShell role="admin"><AdminPageHeader eyebrow="AUTOMATED FOLLOW-UP" title="Class Reminder Rules" description="Configure in-app reminders relative to each scheduled class occurrence. Configuration changes are distinct from reminder delivery." actions={<button className="button ghost" onClick={()=>{void refresh();void loadHealth()}} disabled={locked}>Refresh</button>}/>
 <section className="dashboardKpis"><KpiCard label="Enabled rules" value={loading?"—":rows.filter(r=>r.enabled).length} detail="In-app reminder policies" tone="teal"/><KpiCard label="Trainer reminders" value={loading?"—":rows.filter(r=>r.enabled&&r.recipientRole==="trainer").length} detail="Pre-class and pending update" tone="slate"/><KpiCard label="Family reminders" value={loading?"—":rows.filter(r=>r.enabled&&["parent","student"].includes(r.recipientRole)).length} detail="Parent / learner alerts" tone="amber"/><KpiCard label="Delivery channel" value="In-app" detail="No SMS, email, WhatsApp or push" tone="slate"/></section>
 {error&&<div className="errorBanner" role="alert">{error}</div>}
 <section className="panel"><div className="panelHeader"><div><div className="eyebrow">PROCESSOR HEALTH</div><h2>Reminder processing</h2><p>Monitoring reflects background job executions and created in-app notification records, not proof that a user opened a reminder.</p></div><div className="row" style={{gap:8,flexWrap:"wrap"}}><button className="button ghost" onClick={()=>void loadHealth()}>Refresh health</button><button className="button secondary" disabled={testing} onClick={()=>void test()}>{testing?"Sending…":"Send test to my account"}</button></div></div>
 {healthError&&<div className="errorBanner" role="alert">{healthError}</div>}
 {testNotice&&<div className="infoBanner" role="status">{testNotice}</div>}
 <div className="formGrid"><div><b>Processor:</b> {health?.processorStatus||"Not checked"}<p className="fieldHint">Expected every 5 minutes; more than 15 minutes is overdue.</p></div><div><b>Last successful run:</b> {health?.lastSuccessAt?fmt(health.lastSuccessAt):"Not recorded"}</div><div><b>Generated reminders (24h):</b> {health?health.generated24h:"—"}</div><div><b>Failed/partial jobs (24h):</b> {health?health.failures24h:"—"}</div></div>
 <p className="fieldHint">Last checked: {health?.checkedAt?fmt(health.checkedAt):"Not checked"} · <Link href="/admin/system-logs">Inspect System Logs</Link></p>
 {health?.recent.length?<div className="tableWrap"><table><thead><tr><th>Created</th><th>Recipient role</th><th>Viewed</th></tr></thead><tbody>{health.recent.map(r=><tr key={r.id}><td>{fmt(r.at)}</td><td>{label(r.recipientRole)}</td><td>{r.read?"Yes":"Not yet"}</td></tr>)}</tbody></table></div>:<p className="fieldHint">No matching reminder notifications were recorded in the last 24 hours.</p>}
 </section>
 <section className="panel"><div className="panelHeader"><div><div className="eyebrow">POLICIES</div><h2>Automatic reminder timing</h2><p>Change a value and leave the field to save. Invalid timings are rejected. A Saved indicator means the policy was persisted—not that a reminder was delivered.</p></div><button className="button ghost" disabled={locked} onClick={()=>void reset()}>Reset timing defaults</button></div>
 <div className="tableWrap professionalTable"><table><thead><tr><th>Recipient</th><th>Reminder</th><th>When / explanation</th><th>Enabled</th><th>Configuration state</th></tr></thead><tbody>{rows.map(r=>{const state=states[r.id]||{state:"clean" as const},after=r.eventType==="attendance_pending",max=after?240:1440;return <tr key={r.id}><td><b>{label(r.recipientRole)}</b></td><td>{after?"Attendance / class update pending":"Upcoming class"}</td><td><label className="inlineField"><input className="input tinyInput" type="number" min={5} max={max} step={1} value={after?r.minutesAfter??30:r.minutesBefore??15} disabled={state.state==="saving"} onChange={e=>local(r.id,after?{minutesAfter:e.target.value===""?NaN:Number(e.target.value)}:{minutesBefore:e.target.value===""?NaN:Number(e.target.value)})} onBlur={()=>{if(state.state==="dirty")timing(r)}} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/> {after?"min after class":"min before class"}</label><small className="fieldHint">{after?"Only if the class update remains pending (verify processor condition).":"Based on the scheduled class start time."}</small></td><td><label className="toggleLabel"><input type="checkbox" checked={r.enabled} disabled={state.state==="saving"||state.state==="dirty"} onChange={e=>{const enabled=e.target.checked;local(r.id,{enabled});void save(r.id,{enabled})}}/><span>{r.enabled?"On":"Off"}</span></label></td><td><span className={`inlineSaveState ${state.state}`}>{state.state==="dirty"?"● Unsaved":state.state==="saving"?"Saving…":state.state==="error"?"⚠ "+state.message:state.state==="saved"?"✓ "+state.message:"Saved configuration"}</span>{state.state==="error"&&<button className="button ghost smallButton" onClick={()=>timing(r)}>Retry timing</button>}</td></tr>})}</tbody></table></div>
 {!rows.length&&!loading&&!error&&<p className="fieldHint">No reminder rules found. Check that default rules were seeded.</p>}
 <div className="infoBanner"><b>Timezone-safe:</b> Reminder times follow the stored class occurrence in UTC. A class update reminder must only be generated when its outcome remains pending.</div>
 </section></AppShell></RoleGuard>;
}
