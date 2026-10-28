import type {ClassAttendanceRecord, ScheduleEvent, TrainerEarningRecord} from "./types";
export interface FeePackage {id:string; enrollment_id:string; name:string; scheme:string; currency:string; amount:number; sessions:number|null; billing_model?:'session_package'|'monthly'|'per_class'|'fixed_course'|'open_ended'|'custom'; charge_absences?:boolean; start_date:string; end_date:string; installments:{due:string;amount:number}[]; source?:"portal"|"migration"; notes?:string; created_at?:string}
export interface FeePayment {id:string; package_id:string; amount:number; payment_date:string; method:string; reference:string; kind:"payment"|"refund"; source?:"portal"|"migration"; receipt_number?:string|null; collector_name?:string; collection_location?:string; recorded_by?:string|null; created_at?:string}
export const currencyUnits=(currency:string)=>["BHD","KWD","OMR"].includes(currency.toUpperCase())?1000:100;
export const cents=(n:number)=>Math.round(n*100);
const units=(n:number,currency:string)=>Math.round(n*currencyUnits(currency));
export const money=(n:number,c="INR")=>new Intl.NumberFormat("en-IN",{style:"currency",currency:c}).format(n);
export function packageSummary(p:FeePackage,payments:FeePayment[],attendance:ClassAttendanceRecord[],events:ScheduleEvent[],asOf:string,month="",openingSessions=0){
 const receipts=payments.filter(x=>x.package_id===p.id&&x.payment_date<=asOf);
 const factor=currencyUnits(p.currency);
 const collected=receipts.reduce((s,x)=>s+(x.kind==="refund"?-1:1)*units(x.amount,p.currency),0)/factor;
 const allowed=new Set(["attended","late",...(p.charge_absences?["absent"]:[])]);
 const eventIds=new Set(attendance.filter(a=>a.enrollmentId===p.enrollment_id&&allowed.has(a.status)).map(a=>a.scheduleEventId));
 const eligible=events.filter(e=>eventIds.has(e.id)&&e.status==="conducted"&&e.date>=p.start_date&&e.date<=p.end_date&&e.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const isPackage=(p.billing_model??"session_package")==="session_package";
 const counted=isPackage&&p.sessions!==null?eligible.slice(0,p.sessions):eligible;
 const billableCount=counted.length+(isPackage?Math.max(0,openingSessions):0);
 const completed=isPackage&&p.sessions!==null?Math.min(p.sessions,billableCount):billableCount;
 const isPerClass=p.billing_model==="per_class";
 const billedAmount=isPerClass?units(p.amount,p.currency)*billableCount/factor:p.amount;
 const earnedUnits=(n:number)=>isPerClass?units(p.amount,p.currency)*n:isPackage&&p.sessions?Math.round(units(p.amount,p.currency)*Math.min(p.sessions,n)/p.sessions):0;
 const earned=earnedUnits(completed)/factor;
 const periodEarned=month?(earnedUnits(counted.filter(e=>e.date.slice(0,7)<=month).length)-earnedUnits(counted.filter(e=>e.date.slice(0,7)<month).length))/factor:earned;
 const due=isPerClass?billedAmount:p.installments.filter(i=>i.due<=asOf).reduce((s,i)=>s+units(i.amount,p.currency),0)/factor;
 return {collected,billedAmount,balance:Math.max(0,billedAmount-collected),credit:Math.max(0,collected-billedAmount),overdue:Math.max(0,due-collected),earned,periodEarned,advance:Math.max(0,collected-earned),completed,portalCompleted:counted.length,remainingSessions:isPackage&&p.sessions!==null?Math.max(0,p.sessions-completed):null};
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
 if(!p.enrollment_id||!p.name.trim()||!Number.isFinite(p.amount)||p.amount<=0||Math.abs(p.amount-units(p.amount,p.currency)/currencyUnits(p.currency))>0.0000001||(p.billing_model==='session_package'&&(!Number.isInteger(p.sessions)||Number(p.sessions)<1))||(p.sessions!==null&&(!Number.isInteger(p.sessions)||p.sessions<1))||!p.start_date||!p.end_date||p.end_date<p.start_date)throw Error("Enter a valid enrollment, package, fee, session count and date range.");
 if((p.billing_model!=="per_class"&&!p.installments.length)||p.installments.some(i=>!i.due||!Number.isFinite(i.amount)||i.amount<=0||Math.abs(i.amount-units(i.amount,p.currency)/currencyUnits(p.currency))>0.0000001)||(p.billing_model!=="per_class"&&p.installments.reduce((s,i)=>s+units(i.amount,p.currency),0)!==units(p.amount,p.currency)))throw Error("Instalments must total the agreed package fee exactly.");
 if(existing.some(x=>x.enrollment_id===p.enrollment_id&&x.start_date<=p.end_date&&x.end_date>=p.start_date))throw Error("This enrollment already has a package covering those dates. Use non-overlapping renewal dates.");
}
