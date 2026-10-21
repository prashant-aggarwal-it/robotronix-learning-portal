"use client";

import {useEffect,useMemo,useState} from "react";
import {createAvailabilityOverride,deleteAvailabilityOverride,listAvailabilityOverrides} from "@/lib/repository";
import type {TrainerAvailabilityOverride} from "@/lib/types";
import {todayIstDate} from "@/lib/ist-date";

function labelDate(value:string){
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}

export function TrainerAvailabilityOverrideEditor({trainerId,onSaved}:{trainerId:string;onSaved?:()=>void}){
  const[rows,setRows]=useState<TrainerAvailabilityOverride[]>([]);
  const[date,setDate]=useState(todayIstDate());
  const[startTime,setStartTime]=useState("10:00");
  const[endTime,setEndTime]=useState("18:00");
  const[type,setType]=useState<"available"|"unavailable">("unavailable");
  const[reason,setReason]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");

  async function refresh(){setRows(await listAvailabilityOverrides(trainerId))}
  useEffect(()=>{refresh()},[trainerId]);
  useEffect(()=>{if(!msg)return;const timer=setTimeout(()=>setMsg(""),3500);return()=>clearTimeout(timer)},[msg]);

  const upcoming=useMemo(()=>rows.filter(x=>x.date>=todayIstDate()).sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)),[rows]);

  async function add(){
    setMsg("");
    if(!date||!startTime||!endTime){setMsg("Choose a date and valid time window.");return}
    if(endTime<=startTime){setMsg("Date overrides must end after they start.");return}
    setBusy(true);
    const r=await createAvailabilityOverride({trainerId,date,startTime,endTime,type,reason:reason.trim()});
    setBusy(false);
    if(!r.ok){setMsg(r.error??"Unable to save override.");return}
    setReason("");
    await refresh();
    onSaved?.();
    setMsg(r.notificationWarning?"Override saved, but Admin notification could not be sent: "+r.notificationWarning:(type==="unavailable"?"Unavailable period saved. Admin notified.":"Special availability saved. Admin notified."));
  }

  async function remove(id:string){
    setBusy(true);setMsg("");
    const r=await deleteAvailabilityOverride(id);
    setBusy(false);
    if(!r.ok){setMsg(r.error??"Unable to remove override.");return}
    await refresh();onSaved?.();setMsg(r.notificationWarning?"Override removed, but Admin notification could not be sent: "+r.notificationWarning:"Override removed. Admin notified.");
  }

  return <div className="availabilityOverrideEditor">
    <div className="subsectionHeader"><span>DATE OVERRIDES</span><b>Leave & Special Working Hours</b><small>Add leave/unavailable time or a one-off working window for a specific date.</small></div>
    <div className="overrideFormGrid">
      <div className="formGroup"><label>Date</label><input className="input" type="date" min={todayIstDate()} value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div className="formGroup"><label>From</label><input className="input" type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/></div>
      <div className="formGroup"><label>Until</label><input className="input" type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}/></div>
      <div className="formGroup"><label>Type</label><select className="input" value={type} onChange={e=>setType(e.target.value as any)}><option value="unavailable">On leave / unavailable</option><option value="available">Available specially on this date</option></select></div>
      <div className="formGroup overrideReason"><label>Reason <span className="optionalLabel">Optional</span></label><input className="input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Leave, school workshop, special class"/></div>
      <div className="overrideAddAction"><button className="button" type="button" disabled={busy} onClick={add}>+ Add override</button></div>
    </div>
    {msg&&<div className="cellSub availabilityOverrideMessage">{msg}</div>}
    {upcoming.length?<div className="overrideList editableOverrideList">{upcoming.map(o=><div className="overrideRow" key={o.id}><div><b>{labelDate(o.date)}</b><span>{o.startTime}–{o.endTime} IST · {o.reason|| (o.type==="available"?"Special availability":"Unavailable")}</span></div><div className="row"><span className={`statusBadge ${o.type==="available"?"status-active":"status-on_hold"}`}>{o.type==="available"?"Available":"Unavailable"}</span><button className="iconButton dangerIcon" type="button" aria-label="Remove override" disabled={busy} onClick={()=>remove(o.id)}>×</button></div></div>)}</div>:<div className="emptyState compact">No upcoming date-specific overrides.</div>}
  </div>
}
