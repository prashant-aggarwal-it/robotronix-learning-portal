import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string;conversationId:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const details=await invokeConnect<{provider:string}>(session,"connect_unified_conversation",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId});
 if(details.error)return connectRpcFailure(details.error,details.code);
 const provider=details.data?.provider;
 if(provider!=="instagram"&&provider!=="facebook"&&provider!=="email")return NextResponse.json({ok:true,canReply:false,reason:"Use WhatsApp composer for WhatsApp conversations."},{headers:noStore});
 const rpc=provider==="email"?"connect_unified_email_reply":"connect_social_reply";
 const r=await invokeConnect<unknown>(session,rpc,{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId,p_action:"context"});
 if(r.error)return connectRpcFailure(r.error,r.code);
 return NextResponse.json({ok:true,context:r.data},{headers:noStore});
}
