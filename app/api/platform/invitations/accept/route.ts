import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
export async function POST(request:NextRequest){
 try{
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return NextResponse.json({ok:false,error:"JSON required"},{status:415,headers});
  const body:unknown=await request.json().catch(()=>null);
  const token=body&&typeof body==="object"&&!Array.isArray(body)?(body as {token?:unknown}).token:null;
  if(typeof token!=="string"||!/^[a-zA-Z0-9_-]{40,64}$/.test(token))return NextResponse.json({ok:false,error:"Invalid invitation token"},{status:400,headers});
  const bearer=readBearerToken(request.headers.get("authorization"));
  if(!bearer)throw new SaaSAccessError(401,"Sign in first");
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new SaaSAccessError(503,"Service unavailable");
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser(bearer);
  if(authError||!user||user.is_anonymous)throw new SaaSAccessError(401,"Invalid session");
  if(!user.email||!user.email_confirmed_at)throw new SaaSAccessError(403,"Verify your email before accepting");
  const hash=crypto.createHash("sha256").update(token).digest("hex");
  const {data,error}=await db.rpc("saas_accept_invitation_v1",{p_actor_id:user.id,p_token_sha256:hash});
  if(error)return NextResponse.json({ok:false,error:error.code==="42501"?"Invitation invalid or unavailable":error.code==="23505"?"Already a member":"Invitation service unavailable"},{status:error.code==="42501"?403:error.code==="23505"?409:503,headers});
  return NextResponse.json({ok:true,organizationId:data},{headers});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Invitation service unavailable"},{status:error instanceof SaaSAccessError?error.status:503,headers});
 }
}
