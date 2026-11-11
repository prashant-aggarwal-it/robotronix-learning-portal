import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string;conversationId:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const r=await invokeConnect<unknown[]>(session,"connect_unified_message_attachments",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId});
 if(r.error)return connectRpcFailure(r.error,r.code);
 return NextResponse.json({ok:true,attachments:r.data||[]},{headers:noStore});
}
