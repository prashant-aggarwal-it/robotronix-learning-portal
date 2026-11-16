import {NextRequest,NextResponse} from "next/server";
import {createHash,randomBytes} from "node:crypto";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(e:unknown){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Platform operation unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
export async function POST(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object")throw new SaaSAccessError(400,"Invalid request");
  if(body.action==="invite_owner"||body.action==="resend_owner"){
   if(typeof body.organizationId!=="string"||!uuid.test(body.organizationId)||typeof body.email!=="string"||
      body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())||
      (body.action==="resend_owner"&&(!uuid.test(body.invitationId||""))))
     throw new SaaSAccessError(400,"Invalid owner invitation");
   const secret=randomBytes(32).toString("hex");
   const tokenHash=createHash("sha256").update(secret).digest("hex");
   const {data,error}=await db.rpc("saas_platform_owner_invite_v1",{p_actor_id:userId,p_organization_id:body.organizationId,p_email:body.email.trim().toLowerCase(),p_hash:tokenHash,p_replace_id:body.action==="resend_owner"?body.invitationId:null});
   if(error)throw new SaaSAccessError(error.code==="42501"?403:400,"Unable to create owner invitation");
   const url=new URL("/platform-owner-invite?token="+encodeURIComponent(secret),request.nextUrl.origin);
   return NextResponse.json({ok:true,invitation:data,invitationUrl:url.toString(),delivery:"Share this one-time link securely. Automated email delivery is not configured."},{headers});
  }
  if(body.action==="revoke_owner_invitation"){
   if(!uuid.test(body.invitationId||""))throw new SaaSAccessError(400,"Invalid invitation");
   const {error}=await db.rpc("saas_platform_owner_invitation_action_v1",{p_actor_id:userId,p_invitation_id:body.invitationId,p_action:"revoke"});
   if(error)throw new SaaSAccessError(error.code==="42501"?403:400,"Unable to revoke invitation");
   return NextResponse.json({ok:true},{headers});
  }
  const allowed=["set_organization_status","rename_organization","grant_platform_admin","revoke_platform_admin"];
  if(!allowed.includes(body.action))throw new SaaSAccessError(400,"Unsupported action");
  const orgAction=body.action==="set_organization_status"||body.action==="rename_organization";
  if(orgAction&&!uuid.test(body.organizationId||"")||!orgAction&&!uuid.test(body.targetUserId||""))throw new SaaSAccessError(400,"Invalid target");
  if(body.action==="set_organization_status"&&!["active","suspended"].includes(body.value))throw new SaaSAccessError(400,"Invalid status");
  if(body.action==="rename_organization"&&(typeof body.value!=="string"||body.value.trim().length<2||body.value.trim().length>160))throw new SaaSAccessError(400,"Invalid name");
  const {data,error}=await db.rpc("saas_platform_manage_v1",{p_actor_id:userId,p_action:body.action,p_organization_id:orgAction?body.organizationId:null,p_target_user_id:orgAction?null:body.targetUserId,p_value:orgAction?body.value:null});
  if(error)throw new SaaSAccessError(error.code==="42501"?403:error.code==="23514"?409:400,"Platform operation rejected");
  return NextResponse.json({ok:true,result:data},{headers});
 }catch(e){return fail(e)}
}
export async function GET(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const organizationId=request.nextUrl.searchParams.get("organizationId")||"";
  if(!uuid.test(organizationId))throw new SaaSAccessError(400,"Invalid organization");
  const {data,error}=await db.rpc("saas_platform_owner_invites_v1",{p_actor_id:userId,p_organization_id:organizationId});
  if(error)throw new SaaSAccessError(error.code==="42501"?403:503,"Invitations unavailable");
  return NextResponse.json({ok:true,invitations:data??[]},{headers});
 }catch(e){return fail(e)}
}
