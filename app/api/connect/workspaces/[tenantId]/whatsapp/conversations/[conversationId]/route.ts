import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string;conversationId:string}>};
type Data={conversationId:string;personId:string|null;status:string;assignedMemberId:string|null;draft:string;lastReadAt:string|null;canWrite:boolean;canAssign:boolean;team:Array<{id:string;label:string;role:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const result=await invokeConnect<Data>(session,"connect_whatsapp_thread_details",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,details:result.data},{headers:noStore});
}
const actions=new Set(["mark_read","save_draft","set_status","assign","link_contact"]);
export async function PATCH(request:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid action.",400);
 const value=body as Record<string,unknown>;
 if(typeof value.action!=="string"||!actions.has(value.action)||!value.data||
  typeof value.data!=="object"||Array.isArray(value.data)||JSON.stringify(value.data).length>3500)
  return connectFailure("Invalid conversation action.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const result=await invokeConnect<{ok:boolean}>(session,"connect_whatsapp_manage_thread",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId,
  p_action:value.action,p_data:value.data
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true},{headers:noStore});
}
