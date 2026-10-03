import type {ClassAttendanceRecord, ScheduleEvent, TrainerEarningRecord} from "./types";
export interface FeePackage {id:string; enrollment_id:string; name:string; scheme:string; currency:string; amount:number; sessions:number; start_date:string; end_date:string; installments:{due:string;amount:number}[]; created_at?:string}
export interface FeePayment {id:string; package_id:string; amount:number; payment_date:string; method:string; reference:string; kind:"payment"|"refund"; created_at?:string}
export const cents=(n:number)=>Math.round(n*100);
export const money=(n:number,c="INR")=>new Intl.NumberFormat("en-IN",{style:"currency",currency:c}).format(n);
export function packageSummary(p:FeePackage,payments:FeePayment[],attendance:ClassAttendanceRecord[],events:ScheduleEvent[],asOf:string,month=""){
 const receipts=payments.filter(x=>x.package_id===p.id&&x.payment_date<=asOf);
 const collected=receipts.reduce((s,x)=>s+(x.kind==="refund"?-1:1)*cents(x.amount),0)/100;
 const ids=new Set(attendance.filter(a=>a.enrollmentId===p.enrollment_id&&["attended","late"].includes(a.status)).map(a=>a.scheduleEventId));
 const completed=events.filter(e=>ids.has(e.id)&&e.status==="conducted"&&e.date>=p.start_date&&e.date<=p.end_date&&e.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).slice(0,p.sessions);
 const earnedCents=(n:number)=>Math.round(cents(p.amount)*n/p.sessions);
 const earned=earnedCents(completed.length)/100;
 const periodEarned=month?(earnedCents(completed.filter(e=>e.date.slice(0,7)<=month).length)-earnedCents(completed.filter(e=>e.date.slice(0,7)<month).length))/100:earned;
 const due=p.installments.filter(i=>i.due<=asOf).reduce((s,i)=>s+cents(i.amount),0)/100;
 return {collected,balance:Math.max(0,p.amount-collected),credit:Math.max(0,collected-p.amount),overdue:Math.max(0,due-collected),earned,periodEarned,advance:Math.max(0,collected-earned),completed:completed.length};
}
export function allocatedCost(enrollmentId:string,earnings:TrainerEarningRecord[],attendance:ClassAttendanceRecord[],events:ScheduleEvent[],month:string){
 return earnings.filter(e=>e.status!=="void"&&(!month||e.earningDate.startsWith(month))).reduce((sum,e)=>{
 const event=events.find(x=>x.id===e.scheduleEventId);
 const ids=[...new Set(attendance.filter(a=>a.scheduleEventId===e.scheduleEventId).map(a=>a.enrollmentId).filter(Boolean))].sort();
 if(!ids.length&&event?.enrollmentId)ids.push(event.enrollmentId);
 const index=ids.indexOf(enrollmentId);if(index<0)return sum;
 const total=cents(e.totalAmount),base=Math.floor(total/ids.length),remainder=total-base*ids.length;
 return sum+(base+(index<remainder?1:0))/100;
 },0);
}
export function validatePackage(p:FeePackage,existing:FeePackage[]){
 if(!p.enrollment_id||!p.name.trim()||!Number.isFinite(p.amount)||p.amount<=0||!Number.isInteger(p.sessions)||p.sessions<1||!p.start_date||!p.end_date||p.end_date<p.start_date)throw Error("Enter a valid enrollment, package, fee, session count and date range.");
 if(!p.installments.length||p.installments.some(i=>!i.due||!Number.isFinite(i.amount)||i.amount<=0)||p.installments.reduce((s,i)=>s+cents(i.amount),0)!==cents(p.amount))throw Error("Instalments must total the agreed package fee exactly.");
 if(existing.some(x=>x.enrollment_id===p.enrollment_id&&x.start_date<=p.end_date&&x.end_date>=p.start_date))throw Error("This enrollment already has a package covering those dates. Use non-overlapping renewal dates.");
}
