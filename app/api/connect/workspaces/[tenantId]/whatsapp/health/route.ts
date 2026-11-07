import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
type Channel={channelId:string;name:string;status:string;syncContacts:number;historicalMessages:number;lastMessageAt:string|null};
type Queue={channelId:string;pending:number;processing:number;failed:number;completed:number;lastError:string|null};
export async function GET(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const args={p_actor_id:auth.actorId,p_tenant_id:tenantId};
 const [result,queue]=await Promise.all([
  invokeConnect<Channel[]>(auth,"connect_whatsapp_connection_health",args),
  invokeConnect<Queue[]>(auth,"connect_whatsapp_history_queue_health",args)
 ]);
 if(result.error)return connectRpcFailure(result.error,result.code);
 if(queue.error)return connectRpcFailure(queue.error,queue.code);
 return NextResponse.json({ok:true,channels:result.data||[],historyQueue:queue.data||[],
  liveCoexistenceSendingEnabled:false,
  note:"Channel registration does not prove Meta Coexistence is connected. Live sending is disabled pending onboarding."},
  {headers:noStore});
}
