import {NextRequest,NextResponse} from "next/server";
import {readBearerToken,getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
import {platformService} from "@/lib/server/saas/platform-admin";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null),id=body?.organizationId,jobId=body?.jobId;
  if(typeof id!=="string"||typeof jobId!=="string"||!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(jobId))throw new SaaSAccessError(400,"Invalid job");
  const {organizations}=await getAuthorizedOrganizations(readBearerToken(req.headers.get("authorization")));
  const org=resolveAuthorizedOrganization(organizations,id);
  if(!org||!roleHasCapability(org.role,"academy.settings.manage"))throw new SaaSAccessError(403,"Academy administrator required");
  const db=platformService();
  const {data:job,error}=await db.schema("saas").from("academy_email_notification_jobs").select("event_type,provider").eq("id",jobId).eq("organization_id",id).eq("status","failed").maybeSingle();
  if(error||!job)throw new SaaSAccessError(409,"Only failed jobs can be retried");
  const {data:pref}=await db.schema("saas").from("academy_email_notification_preferences").select("enabled,provider,enabled_events").eq("organization_id",id).maybeSingle();
  if(!pref?.enabled||pref.provider!==job.provider||!pref.enabled_events?.includes(job.event_type))throw new SaaSAccessError(409,"Notification event or provider disabled");
  const {data:connection}=await db.schema("saas").from("academy_email_connections").select("status,sender_verified_at").eq("organization_id",id).eq("provider",job.provider).maybeSingle();
  if(connection?.status!=="connected"||!connection.sender_verified_at)throw new SaaSAccessError(409,"Provider unavailable");
  const {data:updated,error:updateError}=await db.schema("saas").from("academy_email_notification_jobs").update({status:"queued",attempts:0,locked_at:null,next_attempt_at:new Date().toISOString(),last_error_code:null,updated_at:new Date().toISOString()}).eq("id",jobId).eq("organization_id",id).eq("status","failed").select("id");
  if(updateError||!updated?.length)throw new SaaSAccessError(409,"Retry unavailable");
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof SaaSAccessError?e.message:"Unable to retry job"},{status:e instanceof SaaSAccessError?e.status:503});}
}
