import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
type Person={id:string;name:string;phone:string|null};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const q=request.nextUrl.searchParams.get("q")?.trim()||"";
 if(q.length<2||q.length>100)return connectFailure("Enter at least 2 characters to search.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const result=await invokeConnect<Person[]>(session,"connect_whatsapp_contact_search",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_query:q,p_limit:25
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,items:result.data||[]},{headers:noStore});
}
