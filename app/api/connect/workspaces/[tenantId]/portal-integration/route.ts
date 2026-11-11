import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,noStore,uuid} from "@/lib/server/connect-auth";

export const dynamic="force-dynamic";
type Context={params:Promise<{tenantId:string}>};

export async function POST(request:NextRequest,{params}:Context){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const body=await request.json().catch(()=>null) as {action?:string}|null;
 if(!body||!["enable","disable"].includes(body.action||""))return connectFailure("Choose enable or disable.",400);
 const status=body.action==="enable"?"active":"disabled";
 const {error}=await session.admin.rpc("connect_portal_demo_bridge",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_action:"install",p_data:{status}
 });
 if(error)return connectFailure(error.code==="42501"?"A CRM owner/admin who is also a Portal admin must connect these applications.":"Unable to update Portal connection.",error.code==="42501"?403:503);
 return NextResponse.json({ok:true,status},{headers:noStore});
}
