import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {platformService} from "@/lib/server/saas/platform-admin";
import {readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function POST(request:NextRequest){
 try{
  const token=readBearerToken(request.headers.get("authorization"));
  if(!token)throw new SaaSAccessError(401,"Sign in first");
  const body=await request.json().catch(()=>null);
  if(typeof body?.token!=="string"||!/^[a-f0-9]{64}$/.test(body.token))throw new SaaSAccessError(400,"Invalid invitation token");
  const db=platformService();
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user||user.is_anonymous||!user.email_confirmed_at)throw new SaaSAccessError(401,"Verified sign-in required");
  const hash=createHash("sha256").update(body.token).digest("hex");
  const {data,error}=await db.rpc("saas_accept_platform_owner_invite_v1",{p_actor_id:user.id,p_token_hash:hash});
  if(error)throw new SaaSAccessError(error.code==="42501"?403:503,"Invitation invalid or expired, or account email does not match");
  return NextResponse.json({ok:true,...data},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Invitation service unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers})}
}
