import {NextRequest,NextResponse} from "next/server";
import {readBearerToken,getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
import {platformService} from "@/lib/server/saas/platform-admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 try{
  const id=req.nextUrl.searchParams.get("organizationId")||"";
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new SaaSAccessError(400,"Invalid academy");
  const {organizations}=await getAuthorizedOrganizations(readBearerToken(req.headers.get("authorization")));
  const org=resolveAuthorizedOrganization(organizations,id);
  if(!org||!roleHasCapability(org.role,"academy.settings.manage"))throw new SaaSAccessError(403,"Academy administrator required");
  const {data,error}=await platformService().schema("saas").from("academy_email_notification_jobs")
   .select("id,event_type,recipient_email,provider,status,attempts,last_error_code,created_at,updated_at")
   .eq("organization_id",id).order("created_at",{ascending:false}).limit(100);
  if(error)throw new SaaSAccessError(503,"Unable to load delivery history");
  return NextResponse.json({jobs:data||[]},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof SaaSAccessError?e.message:"Unable to load delivery history"},{status:e instanceof SaaSAccessError?e.status:503});}
}
