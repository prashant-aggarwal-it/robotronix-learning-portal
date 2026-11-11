import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";

export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid CRM workspace.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const result=await invokeConnect<{items:unknown[]}>(session,"connect_calendar_list",{p_actor_id:session.actorId,p_tenant_id:tenantId});
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,items:result.data?.items||[]},{headers:noStore});
}
export async function POST(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid CRM workspace.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>12000)return connectFailure("Calendar payload is too large.",413);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid calendar request.",400);
 const payload=body as Record<string,unknown>;
 if(payload.action!=="save"||!payload.data||typeof payload.data!=="object"||Array.isArray(payload.data))
  return connectFailure("Unsupported calendar action.",400);
 const data=payload.data as Record<string,unknown>;
 if(JSON.stringify(data).length>9000)return connectFailure("Calendar details exceed the permitted size.",413);
 for(const key of ["id","personId","opportunityId","ownerMemberId"]){
  if(data[key]!=null&&data[key]!==""&&!uuid(data[key]))return connectFailure("Invalid record reference.",400);
 }
 for(const key of ["title","kind","startsAt","endsAt","location","meetingUrl","notes","programme"]){
  if(data[key]!=null&&typeof data[key]!=="string")return connectFailure("Invalid appointment details.",400);
 }
 if(data.version!=null&&(!Number.isInteger(data.version)||Number(data.version)<1))return connectFailure("Invalid appointment version.",400);
 const result=await invokeConnect<{ok:boolean;id:string}>(session,"connect_calendar_save",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_data:data
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json(result.data??{ok:true},{headers:noStore});
}
