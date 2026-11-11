import "server-only";
import {NextRequest} from "next/server";
import {checkServerCapability} from "@/lib/platform/server-access";
import {connectSession,isConnectSession,connectFailure,uuid} from "@/lib/server/connect-auth";

export async function portalBridgeAccess(request:NextRequest,tenantId:string,write=false){
 const available=checkServerCapability("crmPortal");
 if(!available.ok)return {error:connectFailure(available.message,available.status)};
 if(!uuid(tenantId))return {error:connectFailure("Invalid CRM workspace.",400)};
 const session=await connectSession(request);
 if(!isConnectSession(session))return {error:session};
 const {data:context,error}=await session.admin.rpc("connect_portal_demo_bridge",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_action:"context",p_data:{}
 });
 if(error){
  const missing=["42883","42P01","3F000"].includes(error.code||"");
  return {error:connectFailure(missing?"Learning Portal integration is not installed.":"CRM workspace access denied.",missing?503:403)};
 }
 if(!context)return {error:connectFailure("CRM workspace access denied.",403)};
 if(write&&context.role==="viewer")return {error:connectFailure("CRM booking access denied.",403)};
 return {session,role:context.role as string,installed:Boolean(context.installed),portalActorId:context.portalActorId as string|null};
}
