"use client";

import {useMemo,useState} from "react";
import {classDayNames,parsePreferredTimeWindows,preferredTimingNote,preferredWindowDurationMinutes,preferredWindowEndsNextDay,preferredWindowsOverlap,serializePreferredTimeWindows,type PreferredTimeWindow} from "@/lib/learner-options";
import {timeRangeError} from "@/lib/time-range-validation";
import {formatClock,IST_TIMEZONE,isValidTimeZone,shortTimeZoneLabel,zonedRangeParts} from "@/lib/timezones";

const displayDays=classDayNames.slice(1).concat(classDayNames[0]);

function nextDateForDay(day:string,timeZone:string){
  const zone=isValidTimeZone(timeZone)?timeZone:IST_TIMEZONE;
  const now=new Date();
  const weekday=new Intl.DateTimeFormat("en-US",{timeZone:zone,weekday:"long"}).format(now);
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  const current=classDayNames.indexOf(weekday),target=classDayNames.indexOf(day),delta=((target-current)+7)%7;
  return new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+delta)).toISOString().slice(0,10);
}

function indiaReference(window:PreferredTimeWindow,timeZone:string){
  const date=nextDateForDay(window.day,timeZone);
  const range=zonedRangeParts(date,window.start,window.end,timeZone,IST_TIMEZONE);
  const startDay=new Intl.DateTimeFormat("en-US",{timeZone:IST_TIMEZONE,weekday:"short"}).format(range.startInstant);
  const endDay=new Intl.DateTimeFormat("en-US",{timeZone:IST_TIMEZONE,weekday:"short"}).format(range.endInstant);
  return `${startDay} ${formatClock(range.startTime)}–${endDay!==startDay?`${endDay} `:""}${formatClock(range.endTime)} IST`;
}

export function PreferredAvailabilityEditor({value,timeZone,onChange,mode="family",showTimingNote=true}:{value:string;timeZone:string;onChange:(value:string)=>void;mode?:"family"|"trainer";showTimingNote?:boolean}){
  const windows=useMemo(()=>parsePreferredTimeWindows(value),[value]);
  const note=useMemo(()=>preferredTimingNote(value),[value]);
  const[addDayOpen,setAddDayOpen]=useState(false);
  const[copyFrom,setCopyFrom]=useState<string|null>(null);
  const[copyTargets,setCopyTargets]=useState<string[]>([]);
  const[copyMode,setCopyMode]=useState<"merge"|"replace">("replace");
  const[copyNotice,setCopyNotice]=useState("");
  const groupedDays=displayDays.filter(day=>windows.some(w=>w.day===day));

  function commit(next:PreferredTimeWindow[],nextNote=note){setCopyNotice("");onChange(serializePreferredTimeWindows(next,nextNote))}
  function addDay(day:string){if(windows.some(w=>w.day===day))return;commit([...windows,{day,dayOfWeek:classDayNames.indexOf(day),start:"17:00",end:"19:00"}])}
  function addTime(day:string){commit([...windows,{day,dayOfWeek:classDayNames.indexOf(day),start:"17:00",end:"19:00"}])}
  function update(index:number,patch:Partial<PreferredTimeWindow>){commit(windows.map((w,i)=>{if(i!==index)return w;const next={...w,...patch};if(patch.start!==undefined||patch.end!==undefined)next.endsNextDay=next.end<next.start;return next}))}
  function remove(index:number){commit(windows.filter((_,i)=>i!==index))}
  function openCopy(day:string){setCopyFrom(day);setCopyTargets([]);setCopyMode("replace")}
  function applyCopy(){
    if(!copyFrom||!copyTargets.length)return;
    const targets=copyTargets.filter(day=>day!==copyFrom);
    const source=windows.filter(w=>w.day===copyFrom);
    let next=[...windows];
    let copied=0,skipped=0;
    for(const target of targets){
      if(copyMode==="replace")next=next.filter(w=>w.day!==target);
      for(const src of source){
        const candidate={...src,day:target,dayOfWeek:classDayNames.indexOf(target)};
        if(next.some(w=>preferredWindowsOverlap(candidate,w))){skipped++;continue;}
        next.push(candidate);copied++;
      }
    }
    onChange(serializePreferredTimeWindows(next,note));
    const dayCount=targets.length;
    setCopyNotice(copied
      ?`${source.length} time slot${source.length===1?"":"s"} copied from ${copyFrom} to ${dayCount} day${dayCount===1?"":"s"}.${skipped?` ${skipped} overlapping slot${skipped===1?" was":"s were"} skipped.`:""} ${mode==="trainer"?"Click Save availability to apply.":"Review your updated timings before continuing."}`
      :`No timings were copied. ${skipped} overlapping slot${skipped===1?" was":"s were"} skipped. Choose Replace selected days to overwrite existing times.`);
    setCopyFrom(null);setCopyTargets([]);
  }
  const invalidPairs=new Set<number>();windows.forEach((w,i)=>{if(timeRangeError(w.start,w.end,w.endsNextDay,12*60))invalidPairs.add(i)});
  const overlapPairs=new Set<number>();
  windows.forEach((a,i)=>windows.forEach((b,j)=>{if(j>i&&preferredWindowsOverlap(a,b)){overlapPairs.add(i);overlapPairs.add(j)}}));

  const isTrainer=mode==="trainer";
  const isIst=timeZone===IST_TIMEZONE;
  return <div className={`structuredAvailabilityEditor ${isTrainer?"trainerWindowMode":""}`}>
    <div className="structuredAvailabilityMeta"><b>{isTrainer?`Trainer working time: ${shortTimeZoneLabel(timeZone)}`:`Family local time: ${shortTimeZoneLabel(timeZone)}`}</b><span>{isTrainer?(isIst?"Add recurring weekly working windows. Multiple slots per day are supported.":"India time is shown beside each trainer window for Admin scheduling."):isIst?"Enter the family’s preferred IST windows. Overnight windows are supported.":"India time is shown beside each window. Overnight windows are supported."}</span></div>
    {copyNotice&&<div role="status" aria-live="polite" className="successBanner">{copyNotice}</div>}
    <div className="timingDayList">
      {groupedDays.map(day=><div className="timingDayCard" key={day}>
        <div className="timingDayHead"><div><span>{day}</span>{!isTrainer&&!isIst&&<small>{`${shortTimeZoneLabel(timeZone)} local time`}</small>}</div><div className="timingDayActions"><button type="button" className="textButton" onClick={()=>addTime(day)}>+ Add time</button><button type="button" className="textButton" onClick={()=>openCopy(day)}>Copy to…</button></div></div>
        <div className="timingWindowList">{windows.map((w,index)=>({w,index})).filter(x=>x.w.day===day).sort((a,b)=>a.w.start.localeCompare(b.w.start)).map(({w,index})=><div className={`timingWindowRow ${overlapPairs.has(index)||invalidPairs.has(index)?"hasError":""}`} key={`${day}-${index}`}>
          <div className="timeField"><label>From</label><input className={`input ${overlapPairs.has(index)?"invalid":""}`} type="time" value={w.start} onChange={e=>update(index,{start:e.target.value})}/></div><span className="timeArrow">to</span><div className="timeField"><label>Until</label><input className={`input ${overlapPairs.has(index)?"invalid":""}`} type="time" value={w.end} onChange={e=>update(index,{end:e.target.value})}/></div>
          {preferredWindowEndsNextDay(w)&&<div className="overnightHint"><span>↪</span><b>Ends {classDayNames[(w.dayOfWeek+1)%7]} {formatClock(w.end)}</b></div>}{!isIst&&<div className="indiaTimePreview"><span>India time</span><b>{timeRangeError(w.start,w.end,w.endsNextDay,12*60)?"Correct this range":indiaReference(w,timeZone)}</b>{preferredWindowEndsNextDay(w)&&<small>Overnight window · {preferredWindowDurationMinutes(w.start,w.end)/60} hrs</small>}</div>}
          <button type="button" className="iconButton dangerIcon" aria-label={`Remove ${day} timing`} onClick={()=>remove(index)}>×</button>
          {(overlapPairs.has(index)||invalidPairs.has(index))&&<div className="timingValidationMessages" role="alert">{overlapPairs.has(index)&&<div className="inlineFieldError">Overlaps another saved window.</div>}{invalidPairs.has(index)&&<div className="inlineFieldError">{timeRangeError(w.start,w.end,w.endsNextDay,12*60)}</div>}</div>}
        </div>)}</div>
        {copyFrom===day&&<div className="copyTimingPanel"><div><b>Copy {day} timings to</b><div className="copyDayChoices">{displayDays.filter(d=>d!==day).map(d=><label key={d}><input type="checkbox" checked={copyTargets.includes(d)} onChange={e=>setCopyTargets(x=>e.target.checked?[...x,d]:x.filter(v=>v!==d))}/><span>{d.slice(0,3)}</span></label>)}</div></div><div className="copyModeChoices"><label><input type="radio" checked={copyMode==="merge"} onChange={()=>setCopyMode("merge")}/> Merge non-overlapping (overlapping slots skipped)</label><label><input type="radio" checked={copyMode==="replace"} onChange={()=>setCopyMode("replace")}/> Replace selected days (copy exact times)</label></div><div className="row"><button type="button" className="button ghost smallButton" onClick={()=>setCopyFrom(null)}>Cancel</button><button type="button" className="button smallButton" disabled={!copyTargets.length} onClick={applyCopy}>Copy timings</button></div></div>}
      </div>)}
      {!groupedDays.length&&<div className="emptyScheduleState"><b>{isTrainer?"No recurring availability saved.":"No preferred windows saved."}</b><span>{isTrainer?"Add the trainer’s normal weekly working windows.":"Add the family’s confirmed availability."}</span></div>}
    </div>
    <button type="button" className="button ghost timingAddDay" onClick={()=>setAddDayOpen(v=>!v)}>{groupedDays.length?"+ Add another day":"+ Add day"}</button>{addDayOpen&&<div className="dayPickerPanel"><b>Select any remaining day</b><div className="dayPickerOptions">{displayDays.filter(day=>!groupedDays.includes(day)).map(day=><button type="button" className="dayChoice" key={day} onClick={()=>{addDay(day);setAddDayOpen(false)}}>{day.slice(0,3)}</button>)}</div></div>}
    {showTimingNote&&<div className="formGroup timingNoteField"><label>{isTrainer?"Availability note":"Timing note"} <span className="optionalLabel">Optional</span></label><input className="input" value={note} onChange={e=>commit(windows,e.target.value)} placeholder={isTrainer?"e.g. Weekday evenings preferred":"e.g. Saturday morning is easiest"}/></div>}
    {(overlapPairs.size>0||invalidPairs.size>0)&&<div className="errorBanner compactError">Correct invalid or overlapping windows before using these timings for scheduling.</div>}
  </div>
}
