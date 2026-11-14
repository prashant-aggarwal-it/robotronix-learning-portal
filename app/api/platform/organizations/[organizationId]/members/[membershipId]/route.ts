import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getAuthorizedOrganizations,readBearerToken,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(message:string,status:number){return NextResponse.json({ok:false,error:message},{status,headers});}
/** Role management only for established SaaS memberships; actor validated again in the RPC. */
export async function PATCH(request:NextRequest,context:{params:Promise<{organizationId:string;membershipId:string}>}){
 try{
  const {organizationId,membershipId}=await context.params;
  if(!uuid.test(organizationId)||!uuid.test(membershipId))return fail("Invalid identifier",400);
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return fail("JSON required",415);
  const body:unknown=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))return fail("Invalid change",400);
  const record=body as Record<string,unknown>;
  const role=record.role, status=record.status;
  if(typeof role!=="string"||!["owner","admin","staff","trainer","member"].includes(role)
     ||typeof status!=="string"||!["active","suspended","removed"].includes(status))
   return fail("Invalid role or status",400);
  const bearer=readBearerToken(request.headers.get("authorization"));
  const {userId,organizations}=await getAuthorizedOrganizations(bearer);
  const org=resolveAuthorizedOrganization(organizations,organizationId);
  if(!org||!roleHasCapability(org.role,"saas.members.manage"))return fail("Not authorized",403);
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)return fail("Service unavailable",503);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.rpc("saas_manage_membership_v1",{
   p_actor_id:userId,p_organization_id:organizationId,p_membership_id:membershipId,
   p_role_key:role,p_status:status
  });
  if(error)return fail(error.code==="42501"?"Membership change not permitted":error.code==="22023"?"Invalid membership change":"Membership change unavailable",
   error.code==="42501"?403:error.code==="22023"?400:503);
  return NextResponse.json({ok:true},{headers});
 }catch(error){
  return fail(error instanceof SaaSAccessError?error.message:"Membership service unavailable",
   error instanceof SaaSAccessError?error.status:503);
 }
}
