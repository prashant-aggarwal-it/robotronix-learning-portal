import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export function apiFailure(message:string,status=400){
  return NextResponse.json({ok:false,error:message},{status,headers:{"Cache-Control":"no-store"}});
}

export async function requireAdmin(request:NextRequest){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)return{error:apiFailure("Server-side Supabase configuration is missing.",503)};
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return{error:apiFailure("Sign in as an administrator.",401)};
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return{error:apiFailure("Your admin session expired. Sign in again.",401)};
  const {data:profile,error:profileError}=await admin.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
  if(profileError||profile?.role!=="admin"||!profile.active)return{error:apiFailure("Administrator access required.",403)};
  return{admin,actorId:user.id};
}
