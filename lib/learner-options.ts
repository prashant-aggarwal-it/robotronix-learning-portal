import type {WeeklyScheduleSlot} from "./types";

export const gradeOptions=[
  "Nursery","LKG","UKG",
  ...Array.from({length:12},(_,i)=>`Class ${i+1}`),
  "College / University",
  "Other / Not listed",
];

export const classDayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export interface PreferredTimeWindow {day:string;dayOfWeek:number;start:string;end:string;endsNextDay?:boolean}

export function parsePreferredTimeWindows(value?:string):PreferredTimeWindow[]{
  if(!value)return[];
  const rows:PreferredTimeWindow[]=[];
  for(const raw of value.split(/\r?\n/)){
    const line=raw.trim();
    if(!line||/^note\s*:/i.test(line))continue;
    const match=line.match(/^([A-Za-z]+)\s*:\s*(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})(\s*\(\+1 day\))?$/);
    if(!match)continue;
    const dayIndex=classDayNames.findIndex(d=>d.toLowerCase()===match[1].toLowerCase());
    if(dayIndex<0)continue;
    rows.push({day:classDayNames[dayIndex],dayOfWeek:dayIndex,start:normaliseClock(match[2]),end:normaliseClock(match[3]),endsNextDay:Boolean(match[4])||normaliseClock(match[3])<normaliseClock(match[2])});
  }
  return rows;
}

export function preferredTimingNote(value?:string){
  const line=(value??"").split(/\r?\n/).map(x=>x.trim()).find(x=>/^note\s*:/i.test(x));
  return line?.replace(/^note\s*:\s*/i,"")??"";
}


export function serializePreferredTimeWindows(windows: PreferredTimeWindow[], note = "") {
  const ordered = [...windows].sort((a,b)=>a.dayOfWeek-b.dayOfWeek||a.start.localeCompare(b.start));
  return [...ordered.map(w=>`${w.day}: ${w.start}–${w.end}${w.endsNextDay?" (+1 day)":""}`), ...(note.trim() ? [`Note: ${note.trim()}`] : [])].join("\n");
}

export function preferredWindowDurationMinutes(start:string,end:string){
  const a=clockMinutes(start),b=clockMinutes(end);
  const raw=b-a;
  return raw>0?raw:raw+24*60;
}

function absoluteWindowRange(w:PreferredTimeWindow){
  const start=w.dayOfWeek*1440+clockMinutes(w.start);
  return {start,end:start+preferredWindowDurationMinutes(w.start,w.end)};
}

export function preferredWindowsOverlap(a:PreferredTimeWindow,b:PreferredTimeWindow){
  const ar=absoluteWindowRange(a),br=absoluteWindowRange(b),week=7*1440;
  for(const shift of [-week,0,week]){
    const bs=br.start+shift,be=br.end+shift;
    if(ar.start<be&&ar.end>bs)return true;
  }
  return false;
}

export function preferredWindowEndsNextDay(w:PreferredTimeWindow){return Boolean(w.endsNextDay)}
export function suggestedScheduleFromPreferences(value:string|undefined,sessionDurationMinutes=60):WeeklyScheduleSlot[]{
  return parsePreferredTimeWindows(value).map(window=>{
    const start=clockMinutes(window.start);
    const available=preferredWindowDurationMinutes(window.start,window.end);
    const requested=Math.max(30,sessionDurationMinutes||60);
    const duration=Math.min(available,requested);
    const endAbsolute=start+Math.max(1,duration);
    return {dayOfWeek:window.dayOfWeek,startTime:window.start,endTime:minutesClockWrap(endAbsolute)};
  });
}

export function preferredTimingSummary(value?:string){
  const windows=parsePreferredTimeWindows(value);
  if(!windows.length)return "Not specified";
  return windows.map(w=>`${w.day.slice(0,3)} ${w.start}–${w.end}${preferredWindowEndsNextDay(w)?" (+1 day)":""}`).join(" · ");
}

function normaliseClock(value:string){
  const[h,m]=value.split(":").map(Number);
  return `${String(Math.max(0,Math.min(23,h))).padStart(2,"0")}:${String(Math.max(0,Math.min(59,m))).padStart(2,"0")}`;
}
function clockMinutes(value:string){const[h,m]=value.split(":").map(Number);return h*60+m}
function minutesClock(value:number){const safe=Math.max(0,Math.min(23*60+59,value));return `${String(Math.floor(safe/60)).padStart(2,"0")}:${String(safe%60).padStart(2,"0")}`}
function minutesClockWrap(value:number){const safe=((value%(24*60))+(24*60))%(24*60);return `${String(Math.floor(safe/60)).padStart(2,"0")}:${String(safe%60).padStart(2,"0")}` }
