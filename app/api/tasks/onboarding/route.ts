import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {taskError,noStore} from "@/lib/server/tasks/auth";
import {resolveDeploymentConfig} from "@/lib/platform/deployment";

export const dynamic="force-dynamic";
async function identity(request:NextRequest){
 const token=request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!token||!url||!key)return null;
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user||user.is_anonymous)return null;
 return {db,user};
}
export async function GET(request:NextRequest){
 const ctx=await identity(request);if(!ctx)return taskError("Sign in to use My Tasks.",401);
 const deployment=resolveDeploymentConfig(process.env);
 const {data:account,error}=await ctx.db.rpc("task_account_get",{p_actor_id:ctx.user.id});
 if(error)return taskError("Task account status unavailable.",503);
 let portalActive=false,portalDisabled=false;
 if(deployment.legacyDefault){
  const {data:profile,error:profileError}=await ctx.db.from("profiles").select("active").eq("id",ctx.user.id).maybeSingle();
  if(profileError)return taskError("Account status unavailable.",503);
  portalActive=profile?.active===true;
  portalDisabled=profile?.active===false;
 }
 return NextResponse.json({ok:true,account,portalActive,portalDisabled,verifiedEmail:Boolean(ctx.user.email_confirmed_at)},{headers:noStore});
}
export async function POST(request:NextRequest){
 const ctx=await identity(request);if(!ctx)return taskError("Sign in to use My Tasks.",401);
 if(!ctx.user.email_confirmed_at||!ctx.user.email)return taskError("Verify your email before creating a task account.",403);
 // Only the pre-existing legacy combined deployment applies the Portal profile policy.
 // Explicit Tasks-only and modular suites read Tasks accounts, never Portal profiles.
 if(resolveDeploymentConfig(process.env).legacyDefault){
  const {data:profile,error:profileError}=await ctx.db.from("profiles").select("active").eq("id",ctx.user.id).maybeSingle();
  if(profileError)return taskError("Account status unavailable.",503);
  if(profile&&!profile.active)return taskError("Your Portal account is disabled.",403);
 }
 if(Number(request.headers.get("content-length")||0)>2048)return taskError("Request too large.",413);
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Enter your display name.",400);
 const name=(raw as Record<string,unknown>).display_name;
 if(typeof name!=="string"||name.trim().length<2||name.trim().length>100)return taskError("Display name must contain 2–100 characters.",400);
 const {data,error}=await ctx.db.rpc("task_account_activate",{p_actor_id:ctx.user.id,p_display_name:name.trim()});
 if(error){if(error.code==="42501")return taskError("Account is unavailable.",403);
  // No writes to Portal telemetry tables: standalone Tasks has no Portal schema.
  console.error("[tasks-onboarding]",{code:error.code||"TASK_ACCOUNT_FAILED"});
  return taskError("Unable to create task account.",500);
 }
 return NextResponse.json({ok:true,account:data},{headers:noStore});
}
