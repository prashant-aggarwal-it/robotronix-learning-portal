import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
function validDate(v:unknown):v is string{
 return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&
  !Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().startsWith(v);
}
export async function GET(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const from=req.nextUrl.searchParams.get("from"),to=req.nextUrl.searchParams.get("to");
 const pipelineId=req.nextUrl.searchParams.get("pipelineId");
 if(!validDate(from)||!validDate(to)||from>to||(pipelineId!==null&&!uuid(pipelineId)))
  return connectFailure("Choose a valid reporting date range and pipeline",400);
 const result=await invokeConnect<Record<string,unknown>>(auth,"connect_report_read",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_from:from,p_to:to,
  p_pipeline_id:pipelineId||null
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,report:result.data},{headers:noStore});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 if(Number(req.headers.get("content-length")||0)>4000)return connectFailure("Request too large",413);
 const value:unknown=await req.json().catch(()=>null);
 if(!value||typeof value!=="object"||Array.isArray(value))return connectFailure("Invalid reporting action",400);
 const body=value as Record<string,unknown>,action=body.action,data=body.data;
 if(!["create_campaign","attribute_campaign","record_spend","record_revenue"].includes(String(action))||
  !data||typeof data!=="object"||Array.isArray(data)||JSON.stringify(data).length>2500)
  return connectFailure("Unsupported reporting action",400);
 const record=data as Record<string,unknown>;
 if(action==="record_spend"||action==="record_revenue"){
  if(!validDate(record.date)||typeof record.amount!=="number"||!Number.isFinite(record.amount)
   ||record.amount<=0||record.amount>999999999999.99||
   typeof record.currency!=="string"||!/^[A-Z]{3}$/.test(record.currency))
   return connectFailure("Provide a valid amount, date and currency",400);
 }
 const result=await invokeConnect<{ok:boolean;id:string}>(auth,"connect_report_write",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_action:action,p_data:data
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json(result.data??{ok:true},{headers:noStore});
}
