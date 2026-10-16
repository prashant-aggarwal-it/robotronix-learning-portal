"use client";
import {useState} from "react";
import type {WeeklyScheduleSlot} from "@/lib/types";
import {dayNames,formatClock,formatWeeklySchedule,IST_TIMEZONE,shortTimeZoneLabel,timeZoneLabel,weeklySlotConversion} from "@/lib/timezones";
import {TimeZoneField} from "@/components/TimeZoneField";
import {classSlotError,minutes} from "@/lib/time-range-validation";

export const HALF_HOUR_TIMES=Array.from({length:48},(_,index)=>{const h=Math.floor(index/2),minute=index%2*30;return `${String(h).padStart(2,"0")}:${String(minute).padStart(2,"0")}`});
function addMinutes(time:string,minutes:number){const [h,m]=time.split(":").map(Number);const total=(h*60+m+minutes)%1440;return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;}
function differenceMinutes(start:string,end:string){const [h1,m1]=start.split(":").map(Number),[h2,m2]=end.split(":").map(Number);return ((h2*60+m2)-(h1*60+m1)+1440)%1440;}
function TimeOptions({value}:{value:string}){return <>{!HALF_HOUR_TIMES.includes(value)&&<option value={value}>{formatClock(value)} (existing time)</option>}{HALF_HOUR_TIMES.map(time=><option value={time} key={time}>{formatClock(time)}</option>)}</>}

export function WeeklyScheduleEditor({timezone,slots,onTimezoneChange,onSlotsChange,label="Weekly class schedule",required=false,disabled=false,adminIstFirst=false,familyTimezone,referenceDate,defaultDurationMinutes=60}:{
 timezone:string;slots:WeeklyScheduleSlot[];onTimezoneChange:(v:string)=>void;onSlotsChange:(v:WeeklyScheduleSlot[])=>void;
 label?:string;required?:boolean;disabled?:boolean;adminIstFirst?:boolean;familyTimezone?:string;referenceDate?:string;defaultDurationMinutes?:number;
}){
 const[dayPickerOpen,setDayPickerOpen]=useState(false);
 const[manuallyChangedEnd,setManuallyChangedEnd]=useState<Record<number,boolean>>({});
 const standardDuration=[60,90,120,150].includes(defaultDurationMinutes)?defaultDurationMinutes:60;
 function addSlot(day:number){const suggested="12:00";onSlotsChange([...slots,{dayOfWeek:day,startTime:suggested,endTime:addMinutes(suggested,standardDuration),endsNextDay:false}]);setDayPickerOpen(false);}
 function update(index:number,patch:Partial<WeeklyScheduleSlot>){
  onSlotsChange(slots.map((slot,i)=>{
   if(i!==index)return slot;
   if(patch.startTime){const duration=differenceMinutes(slot.startTime,slot.endTime);const preferred=manuallyChangedEnd[index]&&duration>=30&&duration<=240?duration:standardDuration;return {...slot,startTime:patch.startTime,endTime:addMinutes(patch.startTime,preferred),endsNextDay:minutes(patch.startTime)!+preferred>=1440};}
   return {...slot,...patch};
  }));
  if(patch.endTime)setManuallyChangedEnd(x=>({...x,[index]:true}));
 }
 function remove(index:number){onSlotsChange(slots.filter((_,i)=>i!==index));setManuallyChangedEnd({});}
 const familyZone=familyTimezone||IST_TIMEZONE;
 const reference=referenceDate||new Date().toISOString().slice(0,10);
 return <div className="weeklyScheduleEditor">
  <div className="scheduleEditorHead"><div><label className="fieldLabel">{label}{required?" *":""}</label><p className="fieldHint">{adminIstFirst?"Choose class times in India time (IST), in 30-minute intervals. Family-local time is shown beside each slot.":"Choose each weekly day and time in 30-minute intervals. The end time initially follows the normal course duration."}</p></div>{!disabled&&<button type="button" className="button ghost smallButton" onClick={()=>setDayPickerOpen(x=>!x)}>+ Add day / time</button>}</div>
  {dayPickerOpen&&!disabled&&<div className="scheduleDayPicker dayPickerPanel"><b>Select any day to add a class</b><div className="dayPickerOptions">{[1,2,3,4,5,6,0].map(day=><button className="dayChoice" type="button" key={day} onClick={()=>addSlot(day)}>{dayNames[day].slice(0,3)}{slots.some(x=>x.dayOfWeek===day)?" · extra time":""}</button>)}</div></div>}
  {adminIstFirst?<div className="scheduleTimezoneContext"><div><span>Operational timezone</span><b>India · IST</b><small>Admin and trainer scheduling uses India time.</small></div><div><span>Family timezone</span><b>{timeZoneLabel(familyZone)}</b><small>Shown for parent confirmation and local-day rollover.</small></div></div>:<TimeZoneField className="scheduleTimezoneField" value={timezone} disabled={disabled} onChange={onTimezoneChange} label="Schedule timezone" required={required} hint="Choose a worldwide IANA timezone. Local times account for daylight-saving changes."/>}
  <div className="scheduleSlotList">{slots.length?slots.map((slot,index)=>{
   const family=adminIstFirst&&familyZone!==IST_TIMEZONE?weeklySlotConversion(slot,IST_TIMEZONE,familyZone,reference):null;
   return <div className={`scheduleSlotRow ${classSlotError(slot)?"hasError":""}`} key={`${slot.dayOfWeek}-${index}`}>
    <div className="formGroup"><label>Day</label><select className="input" value={slot.dayOfWeek} disabled={disabled} onChange={e=>update(index,{dayOfWeek:Number(e.target.value)})}>{dayNames.map((day,i)=><option value={i} key={day}>{day}</option>)}</select></div>
    <div className="formGroup"><label>Start</label><select className="input" value={slot.startTime} disabled={disabled} onChange={e=>update(index,{startTime:e.target.value})}><TimeOptions value={slot.startTime}/></select></div>
    <div className="formGroup"><label>End</label><select className="input" value={slot.endTime} disabled={disabled} onChange={e=>update(index,{endTime:e.target.value})}><TimeOptions value={slot.endTime}/></select></div>
    {(slot.endTime<slot.startTime)&&<div className="nextDayAuto scheduleNextDay">Ends {dayNames[(slot.dayOfWeek+1)%7]}</div>}
    <div className="slotPreview"><span>{dayNames[slot.dayOfWeek]} · {adminIstFirst?"IST":shortTimeZoneLabel(timezone)}</span><b>{formatClock(slot.startTime)}–{formatClock(slot.endTime)}{slot.endsNextDay||(slot.endsNextDay===undefined&&slot.endTime<slot.startTime&&differenceMinutes(slot.startTime,slot.endTime)<=240)?" · next day":""}</b>{family?<small>Family: {family.label} · {shortTimeZoneLabel(familyZone,family.startInstant)}</small>:null}</div>
    {classSlotError(slot)&&<div className="inlineFieldError" role="alert">{classSlotError(slot)}</div>}
    {!disabled&&<button type="button" className="iconButton dangerIcon" title="Remove schedule slot" onClick={()=>remove(index)}>×</button>}
   </div>;}):<div className="emptyScheduleState"><b>No weekly schedule recorded yet.</b><span>{disabled?"This enrollment does not have a recurring schedule.":"Choose any day and a start time. The normal session duration will set the end time automatically."}</span></div>}</div>
  {slots.length>0&&<div className="scheduleSummary"><span>Recurring plan</span><b>{formatWeeklySchedule(slots,adminIstFirst?IST_TIMEZONE:timezone)}</b>{adminIstFirst&&familyZone!==IST_TIMEZONE&&<small>Family timezone: {timeZoneLabel(familyZone)}</small>}</div>}
 </div>;
}
