import "server-only";
import {platformService} from "@/lib/server/saas/platform-admin";
import {sendAcademyGmail} from "@/lib/server/saas/google-email-send";
import {sendAcademySmtp} from "@/lib/server/saas/academy-smtp";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const EVENT_TYPES=["enrollment","class_reminder","fee_reminder","trainer_update","progress_update","invitation"] as const;
export type AcademyEvent=typeof EVENT_TYPES[number];
const email=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
export async function queueAcademyNotification(input:{organizationId:string;eventType:AcademyEvent;idempotencyKey:string;to:string;subject:string;text:string}){
 if(!EVENT_TYPES.includes(input.eventType)||!email.test(input.to)||input.idempotencyKey.length<8||input.idempotencyKey.length>200||/[\r\n]/.test(input.subject)||!input.subject||input.subject.length>240||!input.text||input.text.length>100000)throw new SaaSAccessError(400,"Invalid notification");
 // Internal-only API: event producers must independently verify tenant and recipient ownership.
 const db=platformService();
 const {data:pref,error:prefError}=await db.schema("saas").from("academy_email_notification_preferences").select("enabled,provider,enabled_events").eq("organization_id",input.organizationId).maybeSingle();
 if(prefError||!pref?.enabled||!pref.provider||!pref.enabled_events?.includes(input.eventType))return {queued:false,reason:"disabled"};
 const {data:conn,error:connError}=await db.schema("saas").from("academy_email_connections").select("status,sender_verified_at").eq("organization_id",input.organizationId).eq("provider",pref.provider).maybeSingle();
 if(connError||conn?.status!=="connected"||!conn.sender_verified_at)return {queued:false,reason:"provider_unavailable"};
 const {data,error}=await db.schema("saas").from("academy_email_notification_jobs").upsert({organization_id:input.organizationId,event_type:input.eventType,idempotency_key:input.idempotencyKey,recipient_email:input.to,subject:input.subject,body_text:input.text,provider:pref.provider},{onConflict:"organization_id,idempotency_key",ignoreDuplicates:true}).select("id");
 if(error)throw new SaaSAccessError(503,"Unable to queue academy notification");
 return {queued:true,id:data?.[0]?.id||null};
}
export async function processAcademyNotifications(limit=10){
 const db=platformService();
 const {data:jobs,error}=await db.schema("saas").rpc("claim_academy_email_jobs",{p_limit:Math.min(Math.max(limit,1),25)});
 if(error)throw new SaaSAccessError(503,"Unable to claim notification jobs");
 const results:{id:string;status:string}[]=[];
 for(const job of jobs||[]){
  const {data:pref}=await db.schema("saas").from("academy_email_notification_preferences").select("enabled,provider,enabled_events").eq("organization_id",job.organization_id).maybeSingle();
  const {data:connection}=await db.schema("saas").from("academy_email_connections").select("status,sender_verified_at").eq("organization_id",job.organization_id).eq("provider",job.provider).maybeSingle();
  if(!pref?.enabled||pref.provider!==job.provider||!pref.enabled_events?.includes(job.event_type)||connection?.status!=="connected"||!connection.sender_verified_at){
   await db.schema("saas").from("academy_email_notification_jobs").update({status:"cancelled",last_error_code:"disabled_or_disconnected",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","sending");
   results.push({id:job.id,status:"cancelled"});continue;
  }
  try{
   const sent=job.provider==="google"?await sendAcademyGmail(job.organization_id,job.recipient_email,job.subject,job.body_text):job.provider==="smtp"?await sendAcademySmtp(job.organization_id,job.recipient_email,job.subject,job.body_text):null;
   if(!sent)throw Error("Unsupported provider");
   await db.schema("saas").from("academy_email_notification_jobs").update({status:"sent",provider_message_id:sent.messageId,locked_at:null,last_error_code:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","sending");
   results.push({id:job.id,status:"sent"});
  }catch{
   const terminal=job.attempts>=5;
   await db.schema("saas").from("academy_email_notification_jobs").update({status:terminal?"failed":"retry",locked_at:null,last_error_code:"provider_error",next_attempt_at:new Date(Date.now()+Math.min(3600000,60000*Math.pow(2,Math.max(0,job.attempts-1)))).toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","sending");
   results.push({id:job.id,status:terminal?"failed":"retry"});
  }
 }
 return results;
}
