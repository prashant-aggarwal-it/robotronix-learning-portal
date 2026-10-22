import type {ClassAttendanceRecord,EnrollmentAdminRecord,ScheduleEvent,TrainerCompensationPlan,TrainerEarningRecord,TrainerSessionPayType} from "./types";
import {IST_TIMEZONE,zonedRangeParts} from "./timezones";

export const DEFAULT_COMP_PLAN:Omit<TrainerCompensationPlan,"id"|"trainerId"|"updatedAt">={
 timezone:IST_TIMEZONE,dayStart:"08:00",dayEnd:"22:00",oneToOneDay:300,oneToOneNight:400,groupDay:350,groupNight:450,
 demoDay:80,demoNight:100,demoConversionDay:50,demoConversionNight:100,trainerNoShowPenaltyPercent:100,lateGraceMinutes:5,latePenaltyPercent:0,
 effectiveFrom:"2026-01-01",notes:""
};

export function sessionPayType(event:ScheduleEvent):TrainerSessionPayType{
 if(event.eventType==="demo")return "demo";
 if(event.eventType==="school")return "school";
 if(event.eventType==="workshop")return "workshop";
 if(event.eventType!=="class")return "other";
 return event.cohortId||event.deliveryMode==="small_group"?"small_group":"one_to_one";
}

function inWindow(time:string,start:string,end:string){return start<end?time>=start&&time<end:time>=start||time<end;}
export function calculateTrainerEarning(input:{event:ScheduleEvent;plan:TrainerCompensationPlan;attendance:ClassAttendanceRecord[];enrollments:EnrollmentAdminRecord[];existing?:TrainerEarningRecord|null;conversionApplied?:boolean;adjustment?:number;adjustmentReason?:string}){
 const {event,plan,attendance,enrollments,existing}=input;
 const range=zonedRangeParts(event.date,event.startTime,event.endTime,event.timezone,plan.timezone||IST_TIMEZONE);
 const payBand:"day"|"night"=inWindow(range.startTime,plan.dayStart,plan.dayEnd)?"day":"night";
 const type=sessionPayType(event);
 const relevantAttendance=attendance.filter(a=>a.scheduleEventId===event.id);
 const presentCount=relevantAttendance.filter(a=>["attended","late"].includes(a.status)).length;
 const linkedLearners=event.cohortId?enrollments.filter(e=>e.cohortId===event.cohortId&&e.status!=="cancelled").length:(event.studentId||event.enrollmentId?1:relevantAttendance.length);
 const learnerCount=Math.max(relevantAttendance.length,linkedLearners, type==="demo"?1:0);
 const classOutcome:"cancelled"|"no_show"|"completed"=event.status==="cancelled"?"cancelled":event.status==="conducted"&&type!=="demo"&&relevantAttendance.length>0&&presentCount===0?"no_show":"completed";
 let baseRate=0;
 if(type==="one_to_one")baseRate=payBand==="day"?plan.oneToOneDay:plan.oneToOneNight;
 else if(type==="small_group")baseRate=payBand==="day"?plan.groupDay:plan.groupNight;
 else if(type==="demo")baseRate=payBand==="day"?plan.demoDay:plan.demoNight;
 // Trainer pay follows the agreed scheduled slot, never an unapproved overrun.
 // Actual teaching minutes remain separate and count toward learners' course hours.
 const scheduledMinutes=range.durationMinutes;
 const durationFactor=type==="demo"?1:scheduledMinutes/60;
 const percent=classOutcome==="completed"?100:0;
 const calculatedBase=baseRate*durationFactor*(percent/100);
 const conversionApplied=input.conversionApplied??existing?.conversionApplied??false;
 const conversionBonus=conversionApplied&&type==="demo"?(payBand==="day"?plan.demoConversionDay:plan.demoConversionNight):0;
 const adjustment=input.adjustment??existing?.adjustment??0;
 const totalAmount=Math.round((calculatedBase+conversionBonus+adjustment)*100)/100;
 return {earningDate:range.startDate,sessionType:type,payBand,durationMinutes:scheduledMinutes,learnerCount,classOutcome,baseRate,durationFactor,conversionBonus,adjustment,totalAmount,conversionApplied,adjustmentReason:input.adjustmentReason??existing?.adjustmentReason??""};
}

export function monthKey(date:string){return date.slice(0,7);}
