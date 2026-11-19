import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Counts only. Never return recipient addresses, message bodies, tokens or credentials. */
export async function GET(request:NextRequest){
 try{
  const {db}=await requirePlatformAdmin(request.headers.get("authorization"));
  const organizationId=request.nextUrl.searchParams.get("organizationId");
  if(organizationId&&!uuid.test(organizationId))throw new SaaSAccessError(400,"Invalid organization");
  const since=new Date(Date.now()-7*86400000).toISOString();
  const statuses=["queued","sending","sent","failed"] as const;
  const counts:Record<string,number>={};
  for(const status of statuses){
   let q=db.schema("saas").from("academy_email_notification_jobs").select("id",{count:"exact",head:true}).eq("status",status).gte("created_at",since);
   if(organizationId)q=q.eq("organization_id",organizationId);
   const {count,error}=await q;
   if(error)throw new SaaSAccessError(503,"Delivery health unavailable");
   counts[status]=count??0;
  }
  let connectionQuery=db.schema("saas").from("academy_email_connections").select("organization_id,provider,status,last_error_code,last_checked_at").limit(501);
  if(organizationId)connectionQuery=connectionQuery.eq("organization_id",organizationId);
  const {data:connections,error}=await connectionQuery;
  if(error)throw new SaaSAccessError(503,"Connection health unavailable");
  const connectionSummary={connected:0,attention:0};
  for(const row of connections||[]){
   if(row.status==="connected"||row.status==="active")connectionSummary.connected++;
   else connectionSummary.attention++;
  }
  return NextResponse.json({ok:true,windowDays:7,organizationId:organizationId||null,jobs:counts,
   connections:connectionSummary,connectionRecordsScanned:connections?.length??0,
   connectionsTruncated:(connections?.length??0)>=501,
   // Only expose sanitized operational metadata; no email addresses or credentials.
   connectionDetails:organizationId?(connections||[]).map(x=>({provider:x.provider,status:x.status,lastErrorCode:x.last_error_code,lastCheckedAt:x.last_checked_at})):[]},{headers});
 }catch(e){
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Email health unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});
 }
}
