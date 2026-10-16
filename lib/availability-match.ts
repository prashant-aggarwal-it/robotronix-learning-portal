import type {PreferredTimeWindow} from "./learner-options";
import type {TrainerAvailability,TrainerAvailabilityOverride,WeeklyScheduleSlot} from "./types";
import {IST_TIMEZONE,zonedRangeParts,formatClock,shortTimeZoneLabel} from "./timezones";

type MatchStatus="available"|"partial"|"unavailable";
export interface AvailabilityMatch{window:PreferredTimeWindow;status:MatchStatus;date:string;parentLabel:string;trainerLabel:string;overlapLabel?:string;reason?:string}
type Interval={start:number;end:number};
function m(t:string){const[h,min]=t.split(":").map(Number);return h*60+min}
function clock(n:number){const safe=Math.max(0,Math.min(1440,n));if(safe===1440)return"00:00";return `${String(Math.floor(safe/60)).padStart(2,"0")}:${String(safe%60).padStart(2,"0")}`}
function addDays(date:string,n:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function nextDateForDay(startDate:string,dayOfWeek:number){for(let i=0;i<7;i++){const d=addDays(startDate,i);if(new Date(`${d}T12:00:00Z`).getUTCDay()===dayOfWeek)return d}return startDate}
function intersect(a:Interval,b:Interval):Interval|null{const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);return end>start?{start,end}:null}
function subtract(piece:Interval,block:Interval){const hit=intersect(piece,block);if(!hit)return[piece];const out:Interval[]=[];if(piece.start<hit.start)out.push({start:piece.start,end:hit.start});if(hit.end<piece.end)out.push({start:hit.end,end:piece.end});return out}
function merge(rows:Interval[]){const sorted=rows.filter(x=>x.end>x.start).sort((a,b)=>a.start-b.start);const out:Interval[]=[];for(const row of sorted){const last=out[out.length-1];if(last&&row.start<=last.end)last.end=Math.max(last.end,row.end);else out.push({...row})}return out}
function rangeForStoredWindow(startTime:string,endTime:string){const start=m(startTime),rawEnd=m(endTime);return{start,end:rawEnd>start?rawEnd:1440}}
function dateLabel(date:string){return new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`))}

export function matchPreferredWindows(args:{windows:PreferredTimeWindow[];parentTimezone:string;trainerId:string;startDate:string;availability:TrainerAvailability[];overrides:TrainerAvailabilityOverride[]}):AvailabilityMatch[]{
 return args.windows.map(window=>{
  const parentDate=nextDateForDay(args.startDate,window.dayOfWeek);
  const ist=zonedRangeParts(parentDate,window.start,window.end,args.parentTimezone,IST_TIMEZONE);
  const segments:{date:string;target:Interval}[]=ist.startDate===ist.endDate
    ?[{date:ist.startDate,target:{start:m(ist.startTime),end:m(ist.endTime)}}]
    :[{date:ist.startDate,target:{start:m(ist.startTime),end:1440}},{date:ist.endDate,target:{start:0,end:m(ist.endTime)}}];
  let allFull=true,blocked=false;const overlaps:{date:string;piece:Interval}[]=[];
  for(const segment of segments){
    const trainerDay=new Date(`${segment.date}T12:00:00Z`).getUTCDay();
    const dateOverrides=args.overrides.filter(o=>o.trainerId===args.trainerId&&o.date===segment.date);
    const blockers=dateOverrides.filter(o=>o.type==="unavailable").map(o=>rangeForStoredWindow(o.startTime,o.endTime));
    const special=dateOverrides.filter(o=>o.type==="available").map(o=>rangeForStoredWindow(o.startTime,o.endTime));
    const base=args.availability.filter(a=>a.trainerId===args.trainerId&&a.enabled&&a.dayOfWeek===trainerDay).map(a=>rangeForStoredWindow(a.startTime,a.endTime));
    let pieces=merge([...base,...special].map(w=>intersect(segment.target,w)).filter(Boolean) as Interval[]);
    for(const block of blockers)pieces=merge(pieces.flatMap(piece=>subtract(piece,block)));
    const full=pieces.length>0&&pieces[0].start<=segment.target.start&&pieces.reduce((end,p)=>p.start<=end?Math.max(end,p.end):end,pieces[0].end)>=segment.target.end;
    if(!full)allFull=false;
    const best=[...pieces].sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];if(best)overlaps.push({date:segment.date,piece:best});
    if(blockers.some(b=>Boolean(intersect(segment.target,b))))blocked=true;
  }
  const status:MatchStatus=allFull?"available":overlaps.length?"partial":"unavailable";
  const parentNext=window.end<=window.start?" · ends next day":"";
  const parentLabel=`${window.day} · ${formatClock(window.start)}–${formatClock(window.end)} ${shortTimeZoneLabel(args.parentTimezone)}${parentNext}`;
  const trainerLabel=ist.startDate===ist.endDate
    ?`${formatClock(ist.startTime)}–${formatClock(ist.endTime)} IST`
    :`${dateLabel(ist.startDate)} ${formatClock(ist.startTime)}–${dateLabel(ist.endDate)} ${formatClock(ist.endTime)} IST`;
  const overlapLabel=overlaps.length?overlaps.map(x=>`${dateLabel(x.date)} ${formatClock(clock(x.piece.start))}–${formatClock(clock(x.piece.end))}`).join(" · ")+" IST":undefined;
  return{window,status,date:ist.startDate,parentLabel,trainerLabel,overlapLabel,reason:blocked?"Date-specific blocked/leave time applied":undefined};
 }).sort((a,b)=>({available:0,partial:1,unavailable:2}[a.status]-{available:0,partial:1,unavailable:2}[b.status]));
}

export type ParentWindowFit="inside"|"partial"|"outside"|"not_configured";
export type TrainerWindowFit="available"|"partial"|"unavailable"|"not_configured";

export interface FinalScheduleSlotValidation{
 index:number;
 slot:WeeklyScheduleSlot;
 parentStatus:ParentWindowFit;
 trainerStatus:TrainerWindowFit;
 parentMessage:string;
 trainerMessage:string;
}

type InstantInterval={start:number;end:number};

function overlapsInstant(a:InstantInterval,b:InstantInterval){
 return Math.min(a.end,b.end)>Math.max(a.start,b.start);
}
function containsInstant(container:InstantInterval,target:InstantInterval){
 return container.start<=target.start&&container.end>=target.end;
}

function availablePiecesForIstDate(args:{
 trainerId:string;
 date:string;
 target:Interval;
 availability:TrainerAvailability[];
 overrides:TrainerAvailabilityOverride[];
}){
 const trainerDay=new Date(`${args.date}T12:00:00Z`).getUTCDay();
 const dateOverrides=args.overrides.filter(o=>o.trainerId===args.trainerId&&o.date===args.date);
 const blockers=dateOverrides.filter(o=>o.type==="unavailable").map(o=>rangeForStoredWindow(o.startTime,o.endTime));
 const special=dateOverrides.filter(o=>o.type==="available").map(o=>rangeForStoredWindow(o.startTime,o.endTime));
 const base=args.availability
  .filter(a=>a.trainerId===args.trainerId&&a.enabled&&a.dayOfWeek===trainerDay)
  .map(a=>rangeForStoredWindow(a.startTime,a.endTime));
 let pieces=merge([...base,...special].map(w=>intersect(args.target,w)).filter(Boolean) as Interval[]);
 for(const block of blockers)pieces=merge(pieces.flatMap(piece=>subtract(piece,block)));
 return pieces;
}

/**
 * Validate the exact recurring slots selected by Admin.
 *
 * Final class-plan slots are stored in IST. Parent windows are converted from
 * the family's timezone into IST for the representative week beginning at
 * startDate. Trainer recurring availability and date overrides are also
 * checked in IST.
 *
 * These are soft operational checks. The caller decides whether an Admin
 * override is allowed.
 */
export function validateFinalScheduleSlots(args:{
 slots:WeeklyScheduleSlot[];
 parentWindows:PreferredTimeWindow[];
 parentTimezone:string;
 trainerId:string;
 startDate:string;
 availability:TrainerAvailability[];
 overrides:TrainerAvailabilityOverride[];
}):FinalScheduleSlotValidation[]{
 const trainerConfigured=Boolean(
  args.trainerId&&(
   args.availability.some(a=>a.trainerId===args.trainerId&&a.enabled)||
   args.overrides.some(o=>o.trainerId===args.trainerId)
  )
 );

 const parentIntervals:InstantInterval[]=args.parentWindows.map(window=>{
  const parentDate=nextDateForDay(args.startDate,window.dayOfWeek);
  const converted=zonedRangeParts(parentDate,window.start,window.end,args.parentTimezone||IST_TIMEZONE,IST_TIMEZONE);
  return{start:converted.startInstant.getTime(),end:converted.endInstant.getTime()};
 });

 return args.slots.map((slot,index)=>{
  const slotDate=nextDateForDay(args.startDate,slot.dayOfWeek);
  const slotRange=zonedRangeParts(slotDate,slot.startTime,slot.endTime,IST_TIMEZONE,IST_TIMEZONE);
  const targetInstant={start:slotRange.startInstant.getTime(),end:slotRange.endInstant.getTime()};

  const parentStatus:ParentWindowFit=!args.parentWindows.length
   ?"not_configured"
   :parentIntervals.some(p=>containsInstant(p,targetInstant))
    ?"inside"
    :parentIntervals.some(p=>overlapsInstant(p,targetInstant))
     ?"partial"
     :"outside";

  const parentMessage=parentStatus==="inside"
   ?"Within parent preferred timings"
   :parentStatus==="partial"
    ?"Partly outside parent preferred timings"
    :parentStatus==="outside"
     ?"Outside parent preferred timings"
     :"No parent preferred timings recorded";

  let trainerStatus:TrainerWindowFit="not_configured";
  if(trainerConfigured){
   const segments:{date:string;target:Interval}[]=slotRange.startDate===slotRange.endDate
    ?[{date:slotRange.startDate,target:{start:m(slotRange.startTime),end:m(slotRange.endTime)}}]
    :[
      {date:slotRange.startDate,target:{start:m(slotRange.startTime),end:1440}},
      {date:slotRange.endDate,target:{start:0,end:m(slotRange.endTime)}},
     ];

   let allFull=true;
   let anyOverlap=false;
   for(const segment of segments){
    const pieces=availablePiecesForIstDate({
     trainerId:args.trainerId,
     date:segment.date,
     target:segment.target,
     availability:args.availability,
     overrides:args.overrides,
    });
    if(pieces.length)anyOverlap=true;
    const full=pieces.length>0&&pieces[0].start<=segment.target.start&&
      pieces.reduce((end,p)=>p.start<=end?Math.max(end,p.end):end,pieces[0].end)>=segment.target.end;
    if(!full)allFull=false;
   }
   trainerStatus=allFull?"available":anyOverlap?"partial":"unavailable";
  }

  const trainerMessage=trainerStatus==="available"
   ?"Trainer available for full class slot"
   :trainerStatus==="partial"
    ?"Trainer is available for only part of this slot"
    :trainerStatus==="unavailable"
     ?"Outside trainer availability"
     :"Trainer availability not configured";

  return{index,slot,parentStatus,trainerStatus,parentMessage,trainerMessage};
 });
}

