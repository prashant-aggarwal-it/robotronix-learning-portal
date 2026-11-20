import {NextRequest,NextResponse} from "next/server";
import {performance} from "node:perf_hooks";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
type State="healthy"|"degraded"|"down"|"unknown";
const round=(ms:number)=>Math.round(ms);
export async function GET(request:NextRequest){
 const started=performance.now();
 try{
  const {db}=await requirePlatformAdmin(request.headers.get("authorization"));
  // Authorized service-role RPC exercises actual PostgREST -> PostgreSQL connectivity.
  // No table data, credentials or internal error details are exposed to the browser.
  const probeStart=performance.now();
  const {data,error}=await db.rpc("saas_platform_monitor_read_v1",{p_kind:"email_health",p_organization_id:null});
  const databaseMs=round(performance.now()-probeStart);
  const database:State=error||!data||typeof data!=="object"?"down":databaseMs>2000?"degraded":"healthy";
  if(error)console.error("platform health database probe",error.code);
  const totalMs=round(performance.now()-started);
  const application:State=totalMs>3000?"degraded":"healthy";
  const overall:State=database==="down"?"down":database==="degraded"||application==="degraded"?"degraded":"healthy";
  return NextResponse.json({ok:true,observedAt:new Date().toISOString(),environment:process.env.NODE_ENV,
    overall,checks:[
      {id:"application",name:"Application API",status:application,latencyMs:totalMs,detail:"Authorized application request completed"},
      {id:"database",name:"Database connectivity",status:database,latencyMs:databaseMs,detail:database==="down"?"Database probe failed":"Restricted database probe completed"}
    ],
    scope:"On-demand current-request measurements only. Uptime percentage, global error rates, and historical latency trends are not instrumented.",
    historicalMetrics:{uptimePercent:null,errorRatePercent:null,p95LatencyMs:null}
  },{headers,status:database==="down"?503:200});
 }catch(e){
  const status=e instanceof SaaSAccessError?e.status:503;
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Service health unavailable"},{status,headers});
 }
}
