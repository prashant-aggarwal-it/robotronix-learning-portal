import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};

export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const auth=await connectSession(request);
 if(!isConnectSession(auth))return auth;
 const r=await invokeConnect<unknown[]>(auth,"connect_staff_inbox",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_action:"list"
 });
 if(r.error)return connectRpcFailure(r.error,r.code);
 return NextResponse.json({ok:true,notifications:r.data||[]},{headers:noStore});
}
export async function PATCH(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const auth=await connectSession(request);
 if(!isConnectSession(auth))return auth;
 const b=await request.json().catch(()=>null);
 if(!uuid(b?.notificationId))return connectFailure("Invalid notification",400);
 const r=await invokeConnect<unknown[]>(auth,"connect_staff_inbox",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_action:"read",p_notification_id:b.notificationId
 });
 if(r.error)return connectRpcFailure(r.error,r.code);
 return NextResponse.json({ok:true,notifications:r.data||[]},{headers:noStore});
}
