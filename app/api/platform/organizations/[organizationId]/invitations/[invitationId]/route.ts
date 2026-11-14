import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getAuthorizedOrganizations,resolveAuthorizedOrganization,readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function DELETE(request:NextRequest,context:{params:Promise<{organizationId:string;invitationId:string}>}){
 try {
  const {organizationId,invitationId}=await context.params;
  if(!uuid.test(organizationId)||!uuid.test(invitationId))return NextResponse.json({ok:false,error:"Invalid identifier"},{status:400,headers});
  const {userId,organizations}=await getAuthorizedOrganizations(readBearerToken(request.headers.get("authorization")));
  const org=resolveAuthorizedOrganization(organizations,organizationId);
  if(!org||!roleHasCapability(org.role,"saas.members.manage"))throw new SaaSAccessError(403,"Invitation denied");
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new SaaSAccessError(503,"Service unavailable");
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("saas_revoke_invitation_v1",{
   p_actor_id:userId,p_organization_id:organizationId,p_invitation_id:invitationId
  });
  if(error)return NextResponse.json({ok:false,error:error.code==="42501"?"Invitation denied":"Revocation unavailable"},{status:error.code==="42501"?403:503,headers});
  return NextResponse.json({ok:true,revoked:Boolean(data)},{headers});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Revocation unavailable"},{status:error instanceof SaaSAccessError?error.status:503,headers});
 }
}