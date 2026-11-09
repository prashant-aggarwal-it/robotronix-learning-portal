import {NextRequest,NextResponse} from "next/server";
import {connectFailure,noStore,uuid} from "@/lib/server/connect-auth";
import {portalBridgeAccess} from "@/lib/server/connect-portal-access";

export const dynamic="force-dynamic";
type Context={params:Promise<{tenantId:string}>};

export async function GET(request:NextRequest,{params}:Context){
 const {tenantId}=await params;
 const access=await portalBridgeAccess(request,tenantId);
 if("error" in access)return access.error;
 if(!access.installed)return NextResponse.json({ok:true,connected:false,items:[]},{headers:noStore});
 const {data,error}=await access.session.admin.rpc("connect_portal_lifecycle",{
  p_actor_id:access.session.actorId,p_tenant_id:tenantId,p_action:"list",p_data:{}
 });
 if(error)return connectFailure("Learner lifecycle is temporarily unavailable.",503);
 return NextResponse.json({ok:true,connected:true,items:data?.items||[]},{headers:noStore});
}

export async function POST(request:NextRequest,{params}:Context){
 const {tenantId}=await params;
 const access=await portalBridgeAccess(request,tenantId,true);
 if("error" in access)return access.error;
 if(!access.installed)return connectFailure("Learning Portal integration is disabled.",409);
 if(Number(request.headers.get("content-length")||0)>2000)return connectFailure("Request too large.",413);
 const body=await request.json().catch(()=>null) as {enrollmentId?:unknown;status?:unknown}|null;
 if(!body||!uuid(body.enrollmentId)||!["open","contacted","dismissed"].includes(String(body.status)))
  return connectFailure("Select a valid renewal and status.",400);
 const {error}=await access.session.admin.rpc("connect_portal_lifecycle",{
  p_actor_id:access.session.actorId,p_tenant_id:tenantId,p_action:"mark_renewal",
  p_data:{enrollmentId:body.enrollmentId,status:body.status}
 });
 if(error){
  if(error.code==="42501")return connectFailure("You cannot update this renewal.",403);
  if(error.code==="22023")return connectFailure("This renewal is no longer available.",409);
  return connectFailure("Could not update the renewal.",503);
 }
 return NextResponse.json({ok:true},{headers:noStore});
}
