import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const q=request.nextUrl.searchParams;
 const search=(q.get("search")||"").trim();
 const rawOffset=q.get("offset")||"0";
 const sort=q.get("sort")==="newest"?"newest":"name";
 if(search.length>100||!/^[0-9]{1,6}$/.test(rawOffset))return connectFailure("Invalid contact search.",400);
 const result=await invokeConnect<{items:unknown[];total:number}>(auth,"connect_contact_directory",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_search:search,
  p_offset:Math.min(Number(rawOffset),100000),p_limit:100,p_sort:sort
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,...(result.data||{items:[],total:0})},{headers:noStore});
}
