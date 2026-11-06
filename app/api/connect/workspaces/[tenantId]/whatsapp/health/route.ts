import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
type Channel={channelId:string;name:string;status:string;syncContacts:number;historicalMessages:number;lastMessageAt:string|null};
export async function GET(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<Channel[]>(auth,"connect_whatsapp_connection_health",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,channels:result.data||[],
  liveCoexistenceSendingEnabled:false,
  note:"Channel registration does not prove Meta Coexistence is connected. Live sending is disabled pending onboarding."},
  {headers:noStore});
}
