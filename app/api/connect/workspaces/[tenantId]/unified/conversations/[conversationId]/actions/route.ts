import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string;conversationId:string}>};
export async function PATCH(request:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid action.",400);
 const value=body as Record<string,unknown>;
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 if(value.action==="mark_read"){
  const r=await invokeConnect<boolean>(session,"connect_unified_mark_read",{
   p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId});
  if(r.error)return connectRpcFailure(r.error,r.code);
  return NextResponse.json({ok:true},{headers:noStore});
 }
 if(value.action==="link_contact"&&uuid(value.personId)){
  const r=await invokeConnect<unknown>(session,"connect_unified_link_contact",{
   p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId,p_person_id:value.personId});
  if(r.error)return connectRpcFailure(r.error,r.code);
  return NextResponse.json({ok:true,result:r.data},{headers:noStore});
 }
 if(["mark_enquiry","not_enquiry","save_name"].includes(String(value.action))&&
  value.data&&typeof value.data==="object"&&!Array.isArray(value.data)&&JSON.stringify(value.data).length<=2400){
  const r=await invokeConnect<unknown>(session,"connect_whatsapp_triage",{
   p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId,p_action:value.action,p_data:value.data});
  if(r.error)return connectRpcFailure(r.error,r.code);
  return NextResponse.json({ok:true,result:r.data},{headers:noStore});
 }
 return connectFailure("Unsupported conversation action.",400);
}
