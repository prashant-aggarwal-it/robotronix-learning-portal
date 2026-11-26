"use client";
import {formatPlatformLabel} from "./formatPlatformLabel";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;display_name:string};
type Snapshot={subscription:{plan_code:string;status:string;started_at:string;ends_at:string|null}|null;modules:{module:string;enabled:boolean}[];events:{event_type:string;occurred_at:string}[]};
export default function PlatformSubscriptions({organizations,onChanged,initialOrganizationId=""}:{organizations:Org[];onChanged:()=>void;initialOrganizationId?:string}){
 const [organizationId,setOrganizationId]=useState(initialOrganizationId);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [planCode,setPlanCode]=useState("standard");
 const [endAt,setEndAt]=useState("");
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function authHeaders(){const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");return {Authorization:"Bearer "+session.access_token}}
 async function refresh(id=organizationId){
  if(!id)return;setBusy(true);setMessage("");
  try{const headers=await authHeaders();const response=await fetch("/api/platform-admin/subscriptions?organizationId="+encodeURIComponent(id),{headers,cache:"no-store"});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||"Unable to load subscription");setSnapshot(result)}
  catch(e){setMessage(e instanceof Error?e.message:"Unable to load subscription")}finally{setBusy(false)}
 }
 useEffect(()=>{if(initialOrganizationId)void refresh(initialOrganizationId);},[initialOrganizationId]);
 async function action(name:string,fields:Record<string,unknown>={}){
  if(!organizationId||busy)return;
  if(["cancel","suspend","mark_past_due"].includes(name)&&!window.confirm("Confirm "+name.replaceAll("_"," ")+"? Customer module access may stop immediately."))return;
  setBusy(true);setMessage("");
  try{const headers=await authHeaders();const response=await fetch("/api/platform-admin/subscriptions",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({organizationId,action:name,...fields})});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||"Operation rejected");setMessage("Subscription updated");onChanged();}
  catch(e){setMessage(e instanceof Error?e.message:"Operation rejected")}finally{setBusy(false)}
  await refresh();
 }
 return <section style={{border:"1px solid #ddd5eb",borderRadius:16,padding:20,marginBottom:24}}>
 <h2>Subscription & module management</h2>
 <p>Changes take effect through server-side entitlement checks. Paid plan activation is a manual administrative action; it does not charge the customer.</p>
 {initialOrganizationId?<p><strong>Customer:</strong> {organizations.find(o=>o.id===organizationId)?.display_name||"Selected customer"}</p>:<label>Customer <select value={organizationId} onChange={e=>{setOrganizationId(e.target.value);setSnapshot(null)}}><option value="">Select organization</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}</select></label>}
 <button disabled={!organizationId||busy} onClick={()=>void refresh()}>{initialOrganizationId?"Refresh subscription":"Load subscription"}</button>
 {busy&&!snapshot&&<p role="status">Loading selected customer subscription…</p>}
 {snapshot&&<div style={{display:"grid",gap:14,marginTop:18}}>
  <p><strong>Plan:</strong> {snapshot.subscription?.plan_code?formatPlatformLabel(snapshot.subscription.plan_code):"None"} · <strong>Status:</strong> {snapshot.subscription?.status==="trial"&&snapshot.subscription.ends_at&&Date.parse(snapshot.subscription.ends_at)<Date.now()?"Expired trial":snapshot.subscription?.status?formatPlatformLabel(snapshot.subscription.status):"None"} · <strong>Ends:</strong> {snapshot.subscription?.ends_at?new Date(snapshot.subscription.ends_at).toLocaleString():"No end date"}</p>
  <label>Plan code <input value={planCode} onChange={e=>setPlanCode(e.target.value)}/></label>
  <label>New expiry date <input type="datetime-local" value={endAt} onChange={e=>setEndAt(e.target.value)}/></label>
  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
   <button disabled={busy||!endAt} onClick={()=>void action("extend_trial",{endAt:new Date(endAt).toISOString()})}>Extend trial</button>
   <button disabled={busy||!endAt} onClick={()=>void action("activate",{planCode,endAt:new Date(endAt).toISOString()})}>Activate paid plan</button>
   <button disabled={busy} onClick={()=>void action("mark_past_due")}>Mark past due</button>
   <button disabled={busy} onClick={()=>void action("suspend")}>Suspend</button>
   <button disabled={busy} onClick={()=>void action("resume")}>Resume</button>
   <button disabled={busy} onClick={()=>void action("cancel")}>Cancel</button>
  </div>
  <h3>Module entitlements</h3>
  {(["academy","crm","tasks"] as const).map(m=>{const enabled=snapshot.modules.some(x=>x.module===m&&x.enabled);return <label key={m}><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>void action("set_module",{moduleKey:m,enabled:e.target.checked})}/> {m==="crm"?"Connect CRM":m==="tasks"?"My Tasks":"Academy"}</label>})}
  <h3>Recent subscription events</h3>
  {snapshot.events.length===0?<p>No events yet.</p>:<ul>{snapshot.events.map((e,i)=><li key={i}>{formatPlatformLabel(e.event_type)} — {new Date(e.occurred_at).toLocaleString()}</li>)}</ul>}
 </div>}
 {message&&<p role="status">{message}</p>}
 </section>;
}
