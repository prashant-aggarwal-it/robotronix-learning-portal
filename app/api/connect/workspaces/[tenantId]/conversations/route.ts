import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const id=request.nextUrl.searchParams.get("personId");
 if(id&&!uuid(id))return connectFailure("Invalid contact",400);
 const auth=await connectSession(request);
 if(!isConnectSession(auth))return auth;
 const r=await invokeConnect<unknown[]>(auth,"connect_conversation_history",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_person_id:id||null,
  p_limit:Math.min(100,Math.max(1,Number(request.nextUrl.searchParams.get("limit")||40)||40))
 });
 if(r.error)return connectRpcFailure(r.error,r.code);
 return NextResponse.json({ok:true,messages:r.data||[]},{headers:noStore});
}
