import {NextRequest,NextResponse} from "next/server";
import {readBearerToken,getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
import {platformService} from "@/lib/server/saas/platform-admin";
import {EVENT_TYPES} from "@/lib/server/saas/academy-notifications";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function authorize(req:NextRequest,id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new SaaSAccessError(400,"Invalid academy");
 const {organizations}=await getAuthorizedOrganizations(readBearerToken(req.headers.get("authorization")));
 const org=resolveAuthorizedOrganization(organizations,id);
 if(!org||!roleHasCapability(org.role,"academy.settings.manage"))throw new SaaSAccessError(403,"Academy administrator required");
}
const output=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){
 try{
  const id=req.nextUrl.searchParams.get("organizationId")||"";await authorize(req,id);
  const db=platformService();
  const {data,error}=await db.schema("saas").from("academy_email_notification_preferences").select("enabled,provider,enabled_events").eq("organization_id",id).maybeSingle();
  if(error)throw new SaaSAccessError(503,"Preferences unavailable");
  return output({ok:true,preferences:data||{enabled:false,provider:null,enabled_events:[]}});
 }catch(e){return output({error:e instanceof SaaSAccessError?e.message:"Preferences unavailable"},e instanceof SaaSAccessError?e.status:503);}
}
export async function PUT(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null),id=body?.organizationId;
  if(typeof id!=="string")throw new SaaSAccessError(400,"Invalid academy");
  await authorize(req,id);
  if(typeof body.enabled!=="boolean"||!(body.provider===null||body.provider==="google"||body.provider==="smtp")||!Array.isArray(body.enabledEvents)||body.enabledEvents.some((x:unknown)=>!EVENT_TYPES.includes(x as typeof EVENT_TYPES[number])))throw new SaaSAccessError(400,"Invalid notification preferences");
  const db=platformService();
  if(body.enabled){
   if(!body.provider)throw new SaaSAccessError(400,"Choose an email provider");
   const {data:conn}=await db.schema("saas").from("academy_email_connections").select("status,sender_verified_at").eq("organization_id",id).eq("provider",body.provider).maybeSingle();
   if(conn?.status!=="connected"||!conn.sender_verified_at)throw new SaaSAccessError(409,"Connect and verify the email provider first");
  }
  const {error}=await db.schema("saas").from("academy_email_notification_preferences").upsert({organization_id:id,enabled:body.enabled,provider:body.provider,enabled_events:[...new Set(body.enabledEvents)],updated_at:new Date().toISOString()},{onConflict:"organization_id"});
  if(error)throw new SaaSAccessError(503,"Unable to save notification preferences");
  return output({ok:true});
 }catch(e){return output({error:e instanceof SaaSAccessError?e.message:"Unable to save preferences"},e instanceof SaaSAccessError?e.status:503);}
}
