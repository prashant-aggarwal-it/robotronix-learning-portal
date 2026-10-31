import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export async function GET(req:NextRequest){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const bearer=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!url||!secret)return NextResponse.json({error:"System logs unavailable"},{status:503});
 if(!bearer)return NextResponse.json({error:"Unauthorized"},{status:401});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await admin.auth.getUser(bearer);
 if(authError||!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:profile,error:profileError}=await admin.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(profileError||!profile?.active||profile.role!=="admin")return NextResponse.json({error:"Forbidden"},{status:403});
 const level=req.nextUrl.searchParams.get("level")||"";
 const q=(req.nextUrl.searchParams.get("q")||"").slice(0,80).replace(/[,()]/g,"");
 let query=admin.from("portal_system_logs").select("id,occurred_at,level,source,action,reference_id,error_code,safe_message").order("occurred_at",{ascending:false}).limit(100);
 if(["error","warning","info"].includes(level))query=query.eq("level",level);
 if(q)query=query.or(`source.ilike.%${q}%,action.ilike.%${q}%,reference_id.ilike.%${q}%`);
 const {data,error}=await query;
 if(error)return NextResponse.json({error:"Unable to read system logs"},{status:500});
 const {data:jobs,error:jobsError}=await admin.from("portal_job_runs").select("id,job_name,started_at,finished_at,status,processed,succeeded,failed,reference_id,error_code,duration_ms").order("started_at",{ascending:false}).limit(120);
 const {data:alerts,error:alertsError}=await admin.from("portal_alert_dispatches").select("id,category,status,created_at,completed_at,failure_code,reference_id").order("created_at",{ascending:false}).limit(40);
 return NextResponse.json({rows:data||[],jobs:jobsError?[]:jobs||[],jobHistoryAvailable:!jobsError,alerts:alertsError?[]:alerts||[],alertHistoryAvailable:!alertsError},{headers:{"Cache-Control":"no-store"}});
}
