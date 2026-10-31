import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const errorResponse=(error:string,status:number)=>NextResponse.json({error},{status,headers:noStore});
async function context(req:NextRequest){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return {error:errorResponse("System logs unavailable",503)};
 const bearer=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!bearer)return {error:errorResponse("Unauthorized",401)};
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await admin.auth.getUser(bearer);
 if(authError||!user)return {error:errorResponse("Unauthorized",401)};
 const {data:profile,error:profileError}=await admin.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(profileError||!profile?.active||profile.role!=="admin")return {error:errorResponse("Forbidden",403)};
 return {admin,actorId:user.id};
}
const fingerprint=(r:{source:string;action:string;error_code:string|null})=>[r.source,r.action,r.error_code||"UNSPECIFIED"].map(s=>encodeURIComponent(s)).join("|");
export async function GET(req:NextRequest){
 const ctx=await context(req);if(ctx.error)return ctx.error;const admin=ctx.admin!;
 const level=req.nextUrl.searchParams.get("level")||"";
 const source=(req.nextUrl.searchParams.get("source")||"").slice(0,80);
 const q=(req.nextUrl.searchParams.get("q")||"").slice(0,80).replace(/[%_,()]/g,"");
 const from=req.nextUrl.searchParams.get("from")||"";
 const to=req.nextUrl.searchParams.get("to")||"";
 const page=Math.min(1000,Math.max(1,Number(req.nextUrl.searchParams.get("page")||1)||1));
 const pageSize=25;
 let query=admin.from("portal_system_logs").select("id,occurred_at,level,source,action,reference_id,error_code,safe_message",{count:"exact"}).order("occurred_at",{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
 if(["error","warning","info"].includes(level))query=query.eq("level",level);
 if(source)query=query.eq("source",source);
 if(q)query=query.or(`source.ilike.%${q}%,action.ilike.%${q}%,reference_id.ilike.%${q}%,error_code.ilike.%${q}%`);
 if(/^\d{4}-\d{2}-\d{2}$/.test(from))query=query.gte("occurred_at",from+"T00:00:00Z");
 if(/^\d{4}-\d{2}-\d{2}$/.test(to))query=query.lte("occurred_at",to+"T23:59:59Z");
 const [eventResult,jobResult,alertResult,issueResult,countsResult]=await Promise.all([
  query,
  admin.from("portal_job_runs").select("id,job_name,started_at,finished_at,status,processed,succeeded,failed,reference_id,error_code,duration_ms").order("started_at",{ascending:false}).limit(120),
  admin.from("portal_alert_dispatches").select("id,category,status,created_at,completed_at,failure_code,reference_id").order("created_at",{ascending:false}).limit(40),
  admin.from("portal_log_issues").select("fingerprint,status,note,updated_at").limit(500),
  admin.from("portal_system_logs").select("level,source,action,error_code,occurred_at").gte("occurred_at",new Date(Date.now()-86400000).toISOString()).order("occurred_at",{ascending:false}).limit(2000),
 ]);
 if(eventResult.error)return errorResponse("Unable to read system logs",500);
 const counts=countsResult.data||[];
 const groups=new Map<string,{fingerprint:string;source:string;action:string;error_code:string|null;count:number;lastSeen:string}>();
 for(const r of counts){if(r.level!=="error"&&r.level!=="warning")continue;const key=fingerprint(r);const item=groups.get(key);if(item)item.count++;else groups.set(key,{fingerprint:key,source:r.source,action:r.action,error_code:r.error_code,count:1,lastSeen:r.occurred_at});}
 return NextResponse.json({
  rows:(eventResult.data||[]).map(r=>({...r,fingerprint:fingerprint(r)})),total:eventResult.count||0,page,pageSize,
  jobs:jobResult.error?[]:jobResult.data||[],jobHistoryAvailable:!jobResult.error,
  alerts:alertResult.error?[]:alertResult.data||[],alertHistoryAvailable:!alertResult.error,
  issues:issueResult.error?[]:issueResult.data||[],issueTrackingAvailable:!issueResult.error,
  groups:[...groups.values()].sort((a,b)=>b.lastSeen.localeCompare(a.lastSeen)).slice(0,30),
  metrics:{errors24h:counts.filter(r=>r.level==="error").length,warnings24h:counts.filter(r=>r.level==="warning").length,countsCapped:counts.length===2000},
  sources:[...new Set(counts.map(r=>r.source))].sort()
 },{headers:noStore});
}
export async function PATCH(req:NextRequest){
 const ctx=await context(req);if(ctx.error)return ctx.error;
 let body:{fingerprint?:string;status?:string;note?:string};
 try{body=await req.json()}catch{return errorResponse("Invalid request",400)}
 const fingerprintValue=String(body.fingerprint||"");
 if(!/^[A-Za-z0-9%._~!()*'-]+\|[A-Za-z0-9%._~!()*'-]+\|[A-Za-z0-9%._~!()*'-]+$/.test(fingerprintValue)||fingerprintValue.length>240)return errorResponse("Invalid issue identifier",400);
 if(!["open","investigating","resolved"].includes(String(body.status)))return errorResponse("Invalid issue status",400);
 const note=String(body.note||"").trim();
 if(note.length>500||/[<>]/.test(note))return errorResponse("Invalid internal note",400);
 // The issue key must correspond to a previously recorded event; it cannot be forged.
 const [source,action,code]=fingerprintValue.split("|").map(decodeURIComponent);
 let existing=ctx.admin!.from("portal_system_logs").select("id").eq("source",source).eq("action",action).limit(1);
 existing=code==="UNSPECIFIED"?existing.is("error_code",null):existing.eq("error_code",code);
 const {data:match,error:lookupError}=await existing;
 if(lookupError||!match?.length)return errorResponse("Issue not found",404);
 const {error}=await ctx.admin!.from("portal_log_issues").upsert({fingerprint:fingerprintValue,status:body.status,note,updated_by:ctx.actorId,updated_at:new Date().toISOString()},{onConflict:"fingerprint"});
 if(error)return errorResponse("Issue tracking unavailable; apply the operational issues migration",503);
 return NextResponse.json({ok:true},{headers:noStore});
}
