import type {PreferredTimeWindow} from "./learner-options";
import type {TrainerAvailability,TrainerAvailabilityOverride} from "./types";
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
