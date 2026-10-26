import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";

export default async () => {
 const started=Date.now(),reference=randomUUID();
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key){
  console.error("[process-reminders]",JSON.stringify({status:"failed",code:"REMINDER_CONFIG_MISSING",reference}));
  return Response.json({ok:false,reference,error:"Reminder service configuration unavailable."},{status:500});
 }
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 async function failure(code){
  console.error("[process-reminders]",JSON.stringify({status:"failed",code,reference,duration_ms:Date.now()-started}));
  const {error}=await client.from("portal_system_logs").insert({reference_id:reference,source:"background-job",action:"process-reminders",level:"error",error_code:code,safe_message:"Automated class reminder processing failed."});
  if(error)console.error("[process-reminders] monitoring write failed",reference,error.code||"unknown");
  return Response.json({ok:false,reference,error:"Reminder processing failed."},{status:500});
 }
 try{
  const {data,error}=await client.rpc("process_class_reminders");
  if(error||!data||data.ok!==true)return await failure("REMINDER_RPC_FAILED");
  const inserted=Number(data.inserted)||0;
  console.info("[process-reminders]",JSON.stringify({status:"success",reference,inserted,duration_ms:Date.now()-started}));
  if(inserted>0){
   const {error:logError}=await client.from("portal_system_logs").insert({reference_id:reference,source:"background-job",action:"process-reminders",level:"info",error_code:null,safe_message:"Class reminder job created "+inserted+" portal notification(s)."});
   if(logError)console.error("[process-reminders] monitoring write failed",reference,logError.code||"unknown");
  }
  return Response.json({ok:true,reference,inserted});
 }catch{
  try{return await failure("REMINDER_UNEXPECTED_FAILURE");}
  catch{console.error("[process-reminders] monitoring unavailable",reference);return Response.json({ok:false,reference,error:"Reminder processing failed."},{status:500});}
 }
};
export const config={schedule:"*/5 * * * *"};
