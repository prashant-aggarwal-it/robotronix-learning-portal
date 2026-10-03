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

export function PreferredAvailabilityEditor({value,timeZone,onChange}:{value:string;timeZone:string;onChange:(value:string)=>void}){
  const windows=useMemo(()=>parsePreferredTimeWindows(value),[value]);
  const note=useMemo(()=>preferredTimingNote(value),[value]);
  const[addDayOpen,setAddDayOpen]=useState(false);
  const[copyFrom,setCopyFrom]=useState<string|null>(null);
  const[copyTargets,setCopyTargets]=useState<string[]>([]);
  const[copyMode,setCopyMode]=useState<"merge"|"replace">("merge");
  const groupedDays=displayDays.filter(day=>windows.some(w=>w.day===day));

  function commit(next:PreferredTimeWindow[],nextNote=note){onChange(serializePreferredTimeWindows(next,nextNote))}
  function addDay(day:string){if(windows.some(w=>w.day===day))return;commit([...windows,{day,dayOfWeek:classDayNames.indexOf(day),start:"17:00",end:"19:00"}])}
  function addTime(day:string){commit([...windows,{day,dayOfWeek:classDayNames.indexOf(day),start:"17:00",end:"19:00"}])}
  function update(index:number,patch:Partial<PreferredTimeWindow>){commit(windows.map((w,i)=>i===index?{...w,...patch}:w))}
  function remove(index:number){commit(windows.filter((_,i)=>i!==index))}
  function openCopy(day:string){setCopyFrom(day);setCopyTargets([]);setCopyMode("merge")}
  function applyCopy(){
    if(!copyFrom||!copyTargets.length){setCopyFrom(null);return}
    const source=windows.filter(w=>w.day===copyFrom);let next=[...windows];
    for(const target of copyTargets.filter(t=>t!==copyFrom)){
      if(copyMode==="replace")next=next.filter(w=>w.day!==target);
      for(const src of source){const candidate={...src,day:target,dayOfWeek:classDayNames.indexOf(target)};if(!next.some(w=>preferredWindowsOverlap(candidate,w)))next.push(candidate)}
    }
    commit(next);setCopyFrom(null);setCopyTargets([])
  }
  const invalidPairs=new Set<number>();windows.forEach((w,i)=>{if(timeRangeError(w.start,w.end,w.endsNextDay,12*60))invalidPairs.add(i)});
  const overlapPairs=new Set<number>();
  windows.forEach((a,i)=>windows.forEach((b,j)=>{if(j>i&&preferredWindowsOverlap(a,b)){overlapPairs.add(i);overlapPairs.add(j)}}));

  return <div className="structuredAvailabilityEditor">
    <div className="structuredAvailabilityMeta"><b>Family local time: {shortTimeZoneLabel(timeZone)}</b><span>India time is shown beside each window. Overnight windows are supported.</span></div>
    <div className="timingDayList">
      {groupedDays.map(day=><div className="timingDayCard" key={day}>
        <div className="timingDayHead"><div><span>{day}</span><small>{shortTimeZoneLabel(timeZone)} local time</small></div><div className="timingDayActions"><button type="button" className="textButton" onClick={()=>addTime(day)}>+ Add another time</button><button type="button" className="textButton" onClick={()=>openCopy(day)}>Copy to…</button></div></div>
        <div className="timingWindowList">{windows.map((w,index)=>({w,index})).filter(x=>x.w.day===day).sort((a,b)=>a.w.start.localeCompare(b.w.start)).map(({w,index})=><div className={`timingWindowRow ${overlapPairs.has(index)||invalidPairs.has(index)?"hasError":""}`} key={`${day}-${index}`}>
          <div className="timeField"><label>From</label><input className={`input ${overlapPairs.has(index)?"invalid":""}`} type="time" value={w.start} onChange={e=>update(index,{start:e.target.value})}/></div><span className="timeArrow">to</span><div className="timeField"><label>Until</label><input className={`input ${overlapPairs.has(index)?"invalid":""}`} type="time" value={w.end} onChange={e=>update(index,{end:e.target.value})}/></div>
          <label className="nextDayCheckbox"><input type="checkbox" checked={Boolean(w.endsNextDay)} onChange={e=>update(index,{endsNextDay:e.target.checked})}/> Ends next day</label><div className="indiaTimePreview"><span>India time</span><b>{timeRangeError(w.start,w.end,w.endsNextDay,12*60)?"Correct this range":indiaReference(w,timeZone)}</b>{preferredWindowEndsNextDay(w)&&<small>Ends next day · {preferredWindowDurationMinutes(w.start,w.end)/60} hrs</small>}</div>
          <button type="button" className="iconButton dangerIcon" aria-label={`Remove ${day} timing`} onClick={()=>remove(index)}>×</button>
          {overlapPairs.has(index)&&<div className="inlineFieldError timingOverlapError">Overlaps another saved family window.</div>}{invalidPairs.has(index)&&<div className="inlineFieldError timingOverlapError">{timeRangeError(w.start,w.end,w.endsNextDay,12*60)}</div>}
        </div>)}</div>
        {copyFrom===day&&<div className="copyTimingPanel"><div><b>Copy {day} timings to</b><div className="copyDayChoices">{displayDays.filter(d=>d!==day).map(d=><label key={d}><input type="checkbox" checked={copyTargets.includes(d)} onChange={e=>setCopyTargets(x=>e.target.checked?[...x,d]:x.filter(v=>v!==d))}/><span>{d.slice(0,3)}</span></label>)}</div></div><div className="copyModeChoices"><label><input type="radio" checked={copyMode==="merge"} onChange={()=>setCopyMode("merge")}/> Merge non-overlapping</label><label><input type="radio" checked={copyMode==="replace"} onChange={()=>setCopyMode("replace")}/> Replace selected days</label></div><div className="row"><button type="button" className="button ghost smallButton" onClick={()=>setCopyFrom(null)}>Cancel</button><button type="button" className="button smallButton" disabled={!copyTargets.length} onClick={applyCopy}>Copy timings</button></div></div>}
      </div>)}
      {!groupedDays.length&&<div className="emptyScheduleState"><b>No preferred windows saved.</b><span>Add the family’s confirmed availability.</span></div>}
    </div>
    <button type="button" className="button ghost timingAddDay" onClick={()=>setAddDayOpen(v=>!v)}>+ Add another day</button>{addDayOpen&&<div className="dayPickerPanel"><b>Select any remaining day</b><div className="dayPickerOptions">{displayDays.filter(day=>!groupedDays.includes(day)).map(day=><button type="button" className="dayChoice" key={day} onClick={()=>{addDay(day);setAddDayOpen(false)}}>{day.slice(0,3)}</button>)}</div></div>}
    <div className="formGroup timingNoteField"><label>Timing note <span className="optionalLabel">Optional</span></label><input className="input" value={note} onChange={e=>commit(windows,e.target.value)} placeholder="e.g. Saturday morning is easiest"/></div>
    {(overlapPairs.size>0||invalidPairs.size>0)&&<div className="errorBanner compactError">Correct invalid or overlapping windows before using these timings for scheduling.</div>}
  </div>
}
