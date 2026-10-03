/** Validate local wall-clock time windows. Overnight requires explicit confirmation. */
export function minutes(time:string):number|null{
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const[h,m]=time.split(":").map(Number);return h*60+m;
}
export function timeRangeError(start:string,end:string,endsNextDay=false,maxMinutes=24*60):string|null{
 const a=minutes(start),b=minutes(end);
 if(a===null||b===null)return "Enter a valid start and end time.";
 if(a===b)return "End time must be later than start time.";
 if(b<a&&!endsNextDay)return "End time must be later than start time. Select Ends next day for an overnight window.";
 if(b>a&&endsNextDay)return "Turn off Ends next day; the end time is already later than the start time.";
 const duration=b<a?(24*60-a+b):b-a;
 if(duration>maxMinutes)return `Time window cannot exceed ${maxMinutes/60} hours.`;
 return null;
}

/** Legacy short overnight class slots (created before explicit marker) remain valid. */
export function classSlotError(slot:{startTime:string;endTime:string;endsNextDay?:boolean}):string|null{
 const a=minutes(slot.startTime),b=minutes(slot.endTime);
 if(a===null||b===null)return "Choose a valid start and end time.";
 const rollover=slot.endsNextDay===true||(slot.endsNextDay===undefined&&b<a&&b+1440-a<=240);
 const error=timeRangeError(slot.startTime,slot.endTime,rollover,240);
 if(error)return error;
 if(a%30||b%30)return "Class times must be at :00 or :30.";
 return null;
}
export function weeklyScheduleError(slots:Array<{startTime:string;endTime:string;dayOfWeek:number;endsNextDay?:boolean}>):string|null{
 if(!slots.length)return "Add at least one class time.";
 for(const slot of slots){const error=classSlotError(slot);if(error)return error;}
 // Detect overlapping weekly ranges, including overnight rollover into the next day.
 const ranges=slots.map(s=>{const start=s.dayOfWeek*1440+minutes(s.startTime)!;
  const end=s.dayOfWeek*1440+minutes(s.endTime)!+(minutes(s.endTime)!<minutes(s.startTime)!?1440:0);
  return{start,end};});
 for(let i=0;i<ranges.length;i++)for(let j=i+1;j<ranges.length;j++){
  for(const shift of [-10080,0,10080])if(ranges[i].start<ranges[j].end+shift&&ranges[i].end>ranges[j].start+shift)return "Class slots cannot overlap.";
 }
 return null;
}
