import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";

type LogEvent={source:string;action:string;level?:"error"|"warning"|"info";code?:string;message:string;referenceId?:string};
const text=(value:string,max:number)=>value.replace(/[\r\n\t]/g," ").slice(0,max);
// Never accept tokens, email addresses, API errors, exception dumps, request bodies or bank fields.
// Messages must be a static operational label, never raw third-party error.message.
export async function logSystemEvent(input:LogEvent):Promise<string>{
 const referenceId=input.referenceId||randomUUID();
 const row={reference_id:referenceId,source:text(input.source,80),action:text(input.action,80),
  level:input.level||"error",error_code:input.code?text(input.code,60):null,
  safe_message:text(input.message,250)};
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key){console.error("[portal-system-log] database configuration unavailable",referenceId);return referenceId;}
 try{
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await admin.from("portal_system_logs").insert(row);
  if(error)console.error("[portal-system-log] write failed",referenceId,error.code||"unknown");
 }catch{console.error("[portal-system-log] unexpected logging failure",referenceId);}
 return referenceId;
}
