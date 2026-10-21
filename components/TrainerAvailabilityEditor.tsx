"use client";

import {useEffect,useMemo,useState} from "react";
import {PreferredAvailabilityEditor} from "@/components/PreferredAvailabilityEditor";
import {classDayNames,parsePreferredTimeWindows,serializePreferredTimeWindows,type PreferredTimeWindow} from "@/lib/learner-options";
import {listTrainerAvailability,saveTrainerAvailability} from "@/lib/repository";
import {IST_TIMEZONE} from "@/lib/timezones";
import {preferredWindowsOverlap} from "@/lib/learner-options";
import {timeRangeError} from "@/lib/time-range-validation";

type Row={dayOfWeek:number;startTime:string;endTime:string;enabled:boolean};

function rowsToEditorValue(rows:Row[]){
  const windows:PreferredTimeWindow[]=rows
    .filter(r=>r.enabled)
    .map(r=>({day:classDayNames[r.dayOfWeek],dayOfWeek:r.dayOfWeek,start:r.startTime,end:r.endTime}));
  return serializePreferredTimeWindows(windows);
}

function editorValueToRows(value:string):Row[]{
  return parsePreferredTimeWindows(value).map(w=>({
    dayOfWeek:w.dayOfWeek,
    startTime:w.start,
    endTime:w.end,
    enabled:true,
  }));
}

export function TrainerAvailabilityEditor({trainerId,onSaved,onCancel}:{trainerId:string;onSaved?:()=>void;onCancel?:()=>void}){
  const[value,setValue]=useState("");
  const[savedValue,setSavedValue]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    let active=true;
    setLoaded(false);
    setMsg("");
    listTrainerAvailability(trainerId).then(rows=>{
      if(!active)return;
      const initial=rowsToEditorValue(rows.map(x=>({dayOfWeek:x.dayOfWeek,startTime:x.startTime,endTime:x.endTime,enabled:x.enabled})));
      setValue(initial);
      setSavedValue(initial);
      setLoaded(true);
    });
    return()=>{active=false};
  },[trainerId]);

  const rows=useMemo(()=>editorValueToRows(value),[value]);

  async function save(){
    const windows=parsePreferredTimeWindows(value);
    const invalid=windows.some(w=>Boolean(timeRangeError(w.start,w.end,w.endsNextDay,12*60)));
    const overlap=windows.some((w,i)=>windows.some((other,j)=>j>i&&preferredWindowsOverlap(w,other)));
    if(invalid||overlap){setMsg("Please correct invalid or overlapping time slots before saving.");return;}
    setBusy(true);
    setMsg("");
    const result=await saveTrainerAvailability(trainerId,rows);
    setBusy(false);
    if(!result.ok){setMsg(result.error??"Unable to save availability.");return}
    setSavedValue(value);
    setMsg(result.notificationWarning?"Availability saved, but Admin notification could not be sent: "+result.notificationWarning:"Availability saved. Admin notified.");
    onSaved?.();
  }

  if(!loaded)return <div className="emptyState compact">Loading availability…</div>;

  return <div className="trainerAvailabilityEditor trainerAvailabilitySharedEditor">
    <PreferredAvailabilityEditor
      value={value}
      timeZone={IST_TIMEZONE}
      onChange={next=>{setValue(next);setMsg("")}}
      mode="trainer"
      showTimingNote={false}
    />
    {value!==savedValue&&<div role="status" className="fieldHint">Unsaved availability changes — click Save availability to apply them.</div>}
    <div className="row trainerAvailabilitySaveRow">
      <button className="button" type="button" disabled={busy} onClick={save}>{busy?"Saving…":"Save availability"}</button>
      {onCancel&&<button className="button ghost" type="button" disabled={busy} onClick={onCancel}>Cancel</button>}
      {msg&&<span className={msg.startsWith("Please correct")||msg.startsWith("Unable")?"errorBanner":"cellSub"} role="status">{msg}</span>}
    </div>
  </div>;
}
