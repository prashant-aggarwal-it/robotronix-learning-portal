"use client";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {KpiCard} from "@/components/admin/KpiCard";
import {listReminderPolicies,saveReminderPolicy} from "@/lib/repository";
import type {ReminderPolicy} from "@/lib/types";

type RowSaveState={state:"clean"|"dirty"|"saving"|"saved"|"error";message?:string};
function roleLabel(role:string){return role.charAt(0).toUpperCase()+role.slice(1)}

export default function ReminderSettings(){
 const[rows,setRows]=useState<ReminderPolicy[]>([]);
 const[rowState,setRowState]=useState<Record<string,RowSaveState>>({});
 async function refresh(){const data=await listReminderPolicies();setRows(data);setRowState(Object.fromEntries(data.map(r=>[r.id,{state:"clean"}])))}
 useEffect(()=>{refresh()},[]);
 function updateLocal(id:string,patch:Partial<ReminderPolicy>){setRows(current=>current.map(r=>r.id===id?{...r,...patch}:r));setRowState(s=>({...s,[id]:{state:"dirty"}}))}
 async function save(id:string,patch:Partial<ReminderPolicy>){
  setRowState(s=>({...s,[id]:{state:"saving"}}));
  const r=await saveReminderPolicy(id,patch);
  if(!r.ok){setRowState(s=>({...s,[id]:{state:"error",message:r.error??"Unable to save"}}));return;}
  setRowState(s=>({...s,[id]:{state:"saved",message:`Saved ${new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`}}));
 }
 function commitTiming(row:ReminderPolicy){if(row.eventType==="attendance_pending")save(row.id,{minutesAfter:row.minutesAfter??30});else save(row.id,{minutesBefore:row.minutesBefore??15})}
 return <RoleGuard allow={["admin"]}><AppShell role="admin"><AdminPageHeader eyebrow="AUTOMATED FOLLOW-UP" title="Class Reminder Rules" description="Configure in-app reminders around actual class occurrences. The scheduler works from each class's UTC instant, so worldwide timezone and daylight-saving changes are handled automatically."/>
  <section className="dashboardKpis"><KpiCard label="Enabled rules" value={rows.filter(r=>r.enabled).length} detail="Automatic in-app reminder policies" tone="purple"/><KpiCard label="Trainer reminders" value={rows.filter(r=>r.enabled&&r.recipientRole==="trainer").length} detail="Before class + pending update follow-up" tone="teal"/><KpiCard label="Family reminders" value={rows.filter(r=>r.enabled&&["parent","student"].includes(r.recipientRole)).length} detail="Parent / learner pre-class nudges" tone="amber"/><KpiCard label="Delivery" value="In-app" detail="No email, WhatsApp, SMS or push" tone="slate"/></section>
  <section className="panel"><div className="panelHeader"><div><div className="eyebrow">POLICIES</div><h2>Automatic reminder timing</h2><p>Edit a timing value and leave the field to save. Each rule shows its own save state so you always know which update succeeded.</p></div></div><div className="tableWrap professionalTable"><table><thead><tr><th>Recipient</th><th>Reminder</th><th>Timing</th><th>Enabled</th><th>Save state</th></tr></thead><tbody>{rows.map(r=>{const state=rowState[r.id]??{state:"clean" as const};return <tr key={r.id}><td><b>{roleLabel(r.recipientRole)}</b></td><td>{r.eventType==="attendance_pending"?"Class update / attendance pending":"Upcoming class"}</td><td>{r.eventType==="attendance_pending"?<label className="inlineField"><input className="input tinyInput" type="number" min={5} max={240} value={r.minutesAfter??30} onChange={e=>updateLocal(r.id,{minutesAfter:Number(e.target.value)})} onBlur={()=>commitTiming(r)}/> min after class</label>:<label className="inlineField"><input className="input tinyInput" type="number" min={5} max={1440} value={r.minutesBefore??15} onChange={e=>updateLocal(r.id,{minutesBefore:Number(e.target.value)})} onBlur={()=>commitTiming(r)}/> min before class</label>}</td><td><label className="toggleLabel"><input type="checkbox" checked={r.enabled} onChange={e=>{const enabled=e.target.checked;updateLocal(r.id,{enabled});save(r.id,{enabled})}}/><span>{r.enabled?"On":"Off"}</span></label></td><td><span className={`inlineSaveState ${state.state}`}>{state.state==="dirty"?"● Unsaved":state.state==="saving"?"Saving…":state.state==="saved"?`✓ ${state.message??"Saved"}`:state.state==="error"?`⚠ ${state.message??"Save failed"}`:"✓ Saved"}</span></td></tr>})}</tbody></table></div><div className="infoBanner"><b>Timezone-safe:</b><span>Schedules stay anchored to the learner's IANA timezone; each dated occurrence is resolved to UTC, and reminders are generated from that instant. DST/offset changes therefore need no manual reminder adjustment.</span></div></section>
 </AppShell></RoleGuard>;
}
