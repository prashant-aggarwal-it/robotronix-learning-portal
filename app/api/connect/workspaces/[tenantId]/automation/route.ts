import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};

export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const session=await connectSession(request);
 if(!isConnectSession(session))return session;
 const result=await invokeConnect<Record<string,unknown>>(session,"connect_automation_settings",{
  p_actor_id:session.actorId,p_tenant_id:tenantId
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,settings:result.data},{headers:noStore});
}

export async function PATCH(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const session=await connectSession(request);
 if(!isConnectSession(session))return session;
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body)||JSON.stringify(body).length>1500)
  return connectFailure("Invalid automation settings",400);
 const b=body as Record<string,unknown>;
 const bools=["assignmentEnabled","initialFollowupEnabled","remindersEnabled"];
 const ints=["followupDelayHours","reminderAdvanceMinutes"];
 for(const key of Object.keys(b)){
  if(!bools.includes(key)&&!ints.includes(key))return connectFailure("Unknown automation option",400);
  if(bools.includes(key)&&typeof b[key]!=="boolean")return connectFailure("Invalid automation option",400);
  if(ints.includes(key)&&(!Number.isInteger(b[key] as number)||
    (key==="followupDelayHours"&&((b[key] as number)<1||(b[key] as number)>168))||
    (key==="reminderAdvanceMinutes"&&((b[key] as number)<5||(b[key] as number)>1440))))
    return connectFailure("Invalid reminder interval",400);
 }
 const result=await invokeConnect<Record<string,unknown>>(session,"connect_automation_settings",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_update:b
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,settings:result.data},{headers:noStore});
}
