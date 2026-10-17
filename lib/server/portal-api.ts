import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export function portalApiFailure(message:string,status=400){
  return NextResponse.json({ok:false,error:message},{status,headers:{"Cache-Control":"no-store"}});
}

export async function requirePortalUser(request:NextRequest,allowedRoles?:string[]){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)return{error:portalApiFailure("Server-side Supabase configuration is missing.",503)};
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return{error:portalApiFailure("Sign in to Robotronix first.",401)};
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return{error:portalApiFailure("Your Robotronix session expired. Sign in again.",401)};
  const {data:profile,error:profileError}=await admin.from("profiles").select("id,role,active,full_name").eq("id",user.id).maybeSingle();
  if(profileError||!profile?.active)return{error:portalApiFailure("Active Robotronix profile required.",403)};
  if(allowedRoles?.length&&!allowedRoles.includes(profile.role))return{error:portalApiFailure("This portal role is not allowed to use this Zoom test.",403)};
  return{admin,user,profile};
}
