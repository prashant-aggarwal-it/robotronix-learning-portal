import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {ingestionClient} from "@/lib/server/connect-ingestion";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function authorized(value:string|null,secret:string|undefined){
 if(!value?.startsWith("Bearer ")||!secret||secret.length<24)return false;
 const x=Buffer.from(value.slice(7),"utf8"),y=Buffer.from(secret,"utf8");
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
// Trigger from an authenticated scheduler, e.g. external cron or Netlify scheduled
// function. No cron is provisioned by this route alone.
export async function POST(req:NextRequest){
 if(!authorized(req.headers.get("authorization"),process.env.CONNECT_REMINDER_JOB_SECRET))
  return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
 try{
  const db=ingestionClient();
  const {data,error}=await db.rpc("connect_run_reminders",{p_batch_size:500});
  if(error)throw new Error(error.code);
  const {data:demoFollowups,error:demoError}=await db.rpc("connect_process_portal_demo_followups",{p_batch_size:100});
  if(demoError)throw new Error(demoError.code);
  const {data:enrollmentConfirmations,error:enrollmentError}=await db.rpc("connect_reconcile_portal_enrollments",{p_batch_size:100});
  if(enrollmentError)throw new Error(enrollmentError.code);
  return NextResponse.json({ok:true,result:data,demoFollowups,enrollmentConfirmations},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({ok:false,error:"Reminder processing unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
