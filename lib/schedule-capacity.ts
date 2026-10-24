/** Shared scheduling arithmetic. All boundaries are minutes after midnight IST.
 * Free time = (weekly working windows + extra availability) - blocked exceptions - bookings.
 * Half-open intervals prevent adjacent classes from counting as an overlap.
 */
export type MinuteWindow={start:number;end:number};
export const timeToMinutes=(value:string)=>{const [h,m]=value.split(":").map(Number);return h*60+m};
export function mergeWindows(windows:MinuteWindow[]):MinuteWindow[]{
 const sorted=windows.filter(x=>Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.end>x.start)
  .map(x=>({start:Math.max(0,x.start),end:Math.min(1440,x.end)}))
  .filter(x=>x.end>x.start).sort((a,b)=>a.start-b.start||a.end-b.end);
 const merged:MinuteWindow[]=[];
 for(const next of sorted){const last=merged[merged.length-1];
  if(last&&next.start<=last.end)last.end=Math.max(last.end,next.end);
  else merged.push({...next});
 }
 return merged;
}
export function subtractWindows(source:MinuteWindow[],exclude:MinuteWindow[]):MinuteWindow[]{
 let remaining=mergeWindows(source);
 for(const blocked of mergeWindows(exclude)){
  remaining=remaining.flatMap(window=>{
   if(blocked.end<=window.start||blocked.start>=window.end)return [window];
   const parts:MinuteWindow[]=[];
   if(blocked.start>window.start)parts.push({start:window.start,end:blocked.start});
   if(blocked.end<window.end)parts.push({start:blocked.end,end:window.end});
   return parts;
  });
 }
 return remaining;
}
export function freeScheduleWindows(
 weekly:MinuteWindow[],
 extra:MinuteWindow[],
 unavailable:MinuteWindow[],
 booked:MinuteWindow[]
):MinuteWindow[]{
 return subtractWindows(subtractWindows(mergeWindows([...weekly,...extra]),unavailable),booked);
}
