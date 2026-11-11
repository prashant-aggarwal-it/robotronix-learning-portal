import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
type Result={items:unknown[];asOf:string;scope:string};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const personId=request.nextUrl.searchParams.get("personId");
 if(personId!==null&&!uuid(personId))return connectFailure("Invalid contact.",400);
 const limitText=request.nextUrl.searchParams.get("limit")||"30";
 if(!/^\d{1,3}$/.test(limitText)||Number(limitText)<1||Number(limitText)>100)return connectFailure("Invalid result limit.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<Result>(auth,"connect_contact_insights",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_person_id:personId||null,p_limit:Number(limitText)
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,items:result.data?.items||[],asOf:result.data?.asOf,scope:result.data?.scope},{headers:noStore});
}
