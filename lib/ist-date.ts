/** Calendar date in Robotronix operational timezone. Do not derive enrollment dates from UTC. */
export function todayIstDate(now:Date=new Date()):string{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value??"";
 return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validNewEnrollmentDate(date:string,now:Date=new Date()){
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=todayIstDate(now);
}
