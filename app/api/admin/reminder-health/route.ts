import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
const fail=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:{"Cache-Control":"no-store"}});
async function getAdmin(req:NextRequest){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return{error:fail("Reminder monitoring unavailable",503)};
 const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return{error:fail("Unauthorized",401)};
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const{data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return{error:fail("Unauthorized",401)};
 const{data:profile,error:profileError}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(profileError||profile?.role!=="admin"||!profile.active)return{error:fail("Forbidden",403)};
 return{db,id:user.id};
}
export async function GET(req:NextRequest){
 const ctx=await getAdmin(req);if(ctx.error)return ctx.error;
 const db=ctx.db!,since=new Date(Date.now()-86400000).toISOString();
 const [runs,notifications]=await Promise.all([
  db.from("portal_job_runs").select("started_at,status,processed,succeeded,failed,duration_ms,error_code").eq("job_name","process-reminders").order("started_at",{ascending:false}).limit(350),
  db.from("portal_notifications").select("id,created_at,recipient_role,title,read_at",{count:"exact"}).in("type",["class_reminder","attendance_pending","class-reminder","reminder"]).gte("created_at",since).order("created_at",{ascending:false}).limit(12)
 ]);
 if(runs.error||notifications.error)return fail("Unable to load reminder health; review job-history and notification permissions.",503);
 const records=runs.data||[],latest=records[0]||null;
 const lastSuccess=records.find(r=>r.status==="success")||null;
 const overdue=!latest||Date.now()-new Date(latest.started_at).getTime()>15*60000;
 return NextResponse.json({
  ok:true,checkedAt:new Date().toISOString(),lastRun:latest,lastSuccessAt:lastSuccess?.started_at||null,
  processorStatus:!latest?"missing":overdue?"overdue":latest.status,
  runs24h:records.filter(r=>r.started_at>=since).length,
  failures24h:records.filter(r=>r.started_at>=since&&r.status!=="success").length,
  generated24h:notifications.count??0,
  recent:(notifications.data||[]).map(n=>({id:n.id,at:n.created_at,recipientRole:n.recipient_role,read:Boolean(n.read_at)})),
  note:"Generated means an in-app notification record was created; it does not prove the user saw it. Notification counts include known reminder types only."
 },{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest){
 const ctx=await getAdmin(req);if(ctx.error)return ctx.error;
 // Admin-only self-test: no student, trainer, email, SMS or Zoom notifications are created.
 let body:{action?:string};
 try{body=await req.json()}catch{return fail("Invalid request",400)}
 if(body.action!=="self-test")return fail("Unsupported action",400);
 const {data,error}=await ctx.db!.from("portal_notifications").insert({
  recipient_role:"admin",recipient_profile_id:ctx.id!,type:"reminder_self_test",priority:"info",
  title:"Reminder system test",message:"This is a test notification created by an administrator. It is not a class reminder.",
  href:"/admin/reminders",dedupe_key:"reminder-self-test:"+ctx.id+":"+randomUUID()
 }).select("id").maybeSingle();
 if(error)return fail("Test notification could not be created; check notification permissions.",503);
 return NextResponse.json({ok:true,id:data?.id},{headers:{"Cache-Control":"no-store"}});
}
