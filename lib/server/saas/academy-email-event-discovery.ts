import "server-only";
import {platformService} from "@/lib/server/saas/platform-admin";
import {queueAcademyNotification} from "@/lib/server/saas/academy-notifications";
const email=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
type Kind="enrollment"|"class_reminder"|"fee_reminder"|"progress_update"|"trainer_update";
const enabledKinds:Kind[]=["enrollment","class_reminder","fee_reminder","progress_update","trainer_update"];
/**
 * Tenant-safe event discovery: never infer ownership from a globally unique legacy ID.
 * Every source enrollment AND student must explicitly belong to the same SaaS organization.
 * No email is sent without a matching guardian contact.
 */
export async function discoverAcademyEmailEvents(maxOrganizations=10){
 const db=platformService(),now=new Date(),today=now.toISOString().slice(0,10);
 const pageSize=Math.min(Math.max(maxOrganizations,1),50);
 const {count,error:countError}=await db.schema("saas").from("academy_email_notification_preferences").select("organization_id",{count:"exact",head:true}).eq("enabled",true);
 if(countError)throw Error("Unable to count enabled academies");
 const total=count||0;
 // Rotate the bounded academy window every scheduler invocation, preventing permanent starvation.
 const offset=total?((Math.floor(now.getTime()/600000)*pageSize)%total):0;
 const {data:first,error}=await db.schema("saas").from("academy_email_notification_preferences")
  .select("organization_id,enabled_events,updated_at").eq("enabled",true).order("organization_id").range(offset,offset+pageSize-1);
 if(error)throw Error("Unable to discover academy email preferences");
 let preferences=first||[];
 if(preferences.length<pageSize&&offset>0){
  const {data:wrapped,error:wrapError}=await db.schema("saas").from("academy_email_notification_preferences")
   .select("organization_id,enabled_events,updated_at").eq("enabled",true).order("organization_id").range(0,pageSize-preferences.length-1);
  if(wrapError)throw Error("Unable to load remaining academies");
  preferences=preferences.concat(wrapped||[]);
 }
 const results:{organizationId:string;queued:number;skipped:number}[]=[];
 for(const pref of preferences||[]){
  const orgId=pref.organization_id,enabled=(pref.enabled_events||[]).filter((k:string)=>enabledKinds.includes(k as Kind));
  if(!enabled.length)continue;
  let queued=0,skipped=0;
  const {data:enrollments,error:enrollmentError}=await db.from("enrollments")
   .select("id,student_id,status,created_at,progress_percent,updated_at")
   .eq("saas_org_id",orgId).order("created_at",{ascending:false}).limit(150);
  if(enrollmentError){results.push({organizationId:orgId,queued,skipped:1});continue;}
  for(const enrollment of enrollments||[]){
   const {data:student}=await db.from("students").select("id,full_name").eq("id",enrollment.student_id).eq("saas_org_id",orgId).maybeSingle();
   if(!student){skipped++;continue;}
   const {data:guardian}=await db.from("student_guardians").select("parent_login_email").eq("student_id",student.id).maybeSingle();
   const to=guardian?.parent_login_email?.trim().toLowerCase();
   if(!to||!email.test(to)){skipped++;continue;}
   async function emit(kind:Kind,key:string,subject:string,body:string){
    const outcome=await queueAcademyNotification({organizationId:orgId,eventType:kind,idempotencyKey:key,to,subject,text:body});
    if(outcome.queued)queued++;else skipped++;
   }
   if(enabled.includes("enrollment")&&enrollment.status==="active"&&enrollment.created_at&&Date.parse(enrollment.created_at)>Math.max(now.getTime()-7*86400000,Date.parse(pref.updated_at||""))){
    await emit("enrollment","enrollment:"+enrollment.id,"Enrollment confirmation","Enrollment for "+student.full_name+" has been recorded. Please contact your academy for class details.");
   }
   if(enabled.includes("progress_update")&&typeof enrollment.progress_percent==="number"&&enrollment.progress_percent>0&&enrollment.updated_at&&Date.parse(enrollment.updated_at)>Math.max(now.getTime()-7*86400000,Date.parse(pref.updated_at||""))){
    await emit("progress_update","progress:"+enrollment.id+":"+Math.floor(enrollment.progress_percent),"Learning progress update","Progress for "+student.full_name+": "+Math.floor(enrollment.progress_percent)+"%.");
   }
   if(enabled.includes("class_reminder")){
    const {data:classes}=await db.from("schedule_events").select("id,date,start_time,timezone,status,title")
     .eq("enrollment_id",enrollment.id).gte("date",today).lte("date",new Date(now.getTime()+2*86400000).toISOString().slice(0,10)).limit(15);
    for(const cls of classes||[]){
     if(!["scheduled","confirmed"].includes(cls.status))continue;
     // Avoid cross-timezone early/late reminders: send only on the local event date.
     if(cls.date!==today)continue;
     await emit("class_reminder","class:"+cls.id+":"+cls.date,"Class reminder","Upcoming class for "+student.full_name+" on "+cls.date+" at "+cls.start_time+" ("+(cls.timezone||"academy timezone")+").");
    }
   }
   if(enabled.includes("fee_reminder")){
    const {data:invoices}=await db.from("student_invoices").select("id,due_date,status,currency,amount_due")
     .eq("enrollment_id",enrollment.id).eq("student_id",student.id).lte("due_date",today).gte("due_date",new Date(now.getTime()-14*86400000).toISOString().slice(0,10)).limit(10);
    for(const invoice of invoices||[]){
     if(!["issued","partially_paid","overdue"].includes(invoice.status))continue;
     await emit("fee_reminder","fee:"+invoice.id+":"+today,"Fee payment reminder","Please review the outstanding fee for "+student.full_name+". Due date: "+invoice.due_date+". Sign in to your academy portal for payment details.");
    }
   }
  }
  if(enabled.includes("trainer_update")){
   const {data:trainers}=await db.from("trainers").select("id,full_name,email").eq("saas_org_id",orgId).limit(100);
   for(const trainer of trainers||[]){
    if(!trainer.email||!email.test(trainer.email))continue;
    const {data:classes}=await db.from("schedule_events").select("id,enrollment_id,date,start_time,timezone,status")
      .eq("trainer_id",trainer.id).eq("date",today).limit(30);
    for(const cls of classes||[]){
     if(!["scheduled","confirmed"].includes(cls.status))continue;
     // Validate class membership in the same tenant before notifying a trainer.
     const {data:owned}=await db.from("enrollments").select("id").eq("id",cls.enrollment_id).eq("saas_org_id",orgId).maybeSingle();
     if(!owned)continue;
     const outcome=await queueAcademyNotification({organizationId:orgId,eventType:"trainer_update",
      idempotencyKey:"trainer-class:"+cls.id+":"+today,to:trainer.email.trim().toLowerCase(),
      subject:"Your class schedule reminder",
      text:"Your scheduled class is on "+cls.date+" at "+cls.start_time+" ("+(cls.timezone||"academy timezone")+")."});
     if(outcome.queued)queued++;else skipped++;
    }
   }
  }
  results.push({organizationId:orgId,queued,skipped});
 }
 return results;
}
