import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function GET(req:NextRequest){
 try{
  const {db}=await requirePlatformAdmin(req.headers.get("authorization"));
  const {data,error}=await db.rpc("saas_platform_worker_health_v1");
  if(error){console.error("Worker health RPC failure",error.code);throw new SaaSAccessError(503,"Worker health unavailable");}
  const h=data?.heartbeat;
  const q=data?.queue||{};
  const age=h?.last_started_at?Date.now()-Date.parse(h.last_started_at):null;
  const stale=age!==null&&Number.isFinite(age)&&age>25*60*1000;
  const queueDelay=Number(q.oldestWaitMinutes||0)>30||Number(q.staleSending||0)>0;
  const status=!h?"unknown":stale||h.last_status==="failed"?"degraded":h.last_status==="running"&&age!==null&&age>15*60*1000?"degraded":queueDelay?"degraded":"healthy";
  return NextResponse.json({ok:true,status,observedAt:data.observedAt,heartbeat:h||null,queue:q,
    note:!h?"No worker execution recorded; not evidence the worker is running.":"Heartbeat only confirms execution reached the worker endpoint, not inbox delivery.",
    scheduledExecutionVerified:false},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Worker health unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
}
