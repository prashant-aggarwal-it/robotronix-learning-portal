import {NextRequest,NextResponse} from "next/server";
import {readBearerToken,getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
import {platformService} from "@/lib/server/saas/platform-admin";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null),id=body?.organizationId;
  if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))throw new SaaSAccessError(400,"Invalid academy");
  const {organizations}=await getAuthorizedOrganizations(readBearerToken(req.headers.get("authorization")));
  const org=resolveAuthorizedOrganization(organizations,id);
  if(!org||!roleHasCapability(org.role,"academy.settings.manage"))throw new SaaSAccessError(403,"Academy administrator required");
  const db=platformService();
  const {data:connection,error}=await db.schema("saas").from("academy_email_connections").select("id").eq("organization_id",id).eq("provider","google").maybeSingle();
  if(error)throw new SaaSAccessError(503,"Unable to disconnect Gmail");
  if(connection){
   const {error:deleteError}=await db.schema("saas").from("academy_email_oauth_credentials").delete().eq("connection_id",connection.id);
   if(deleteError)throw new SaaSAccessError(503,"Unable to remove Gmail credentials");
   const {error:updateError}=await db.schema("saas").from("academy_email_connections").update({status:"disconnected",sender_email:null,sender_verified_at:null,credential_reference:null,updated_at:new Date().toISOString()}).eq("id",connection.id).eq("organization_id",id);
   if(updateError)throw new SaaSAccessError(503,"Unable to disconnect Gmail");
  }
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof SaaSAccessError?e.message:"Unable to disconnect Gmail"},{status:e instanceof SaaSAccessError?e.status:503,headers:{"Cache-Control":"no-store"}})}
}
