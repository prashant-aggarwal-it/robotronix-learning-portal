import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";

export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
type Page={items:unknown[];nextCursor:{at:string;id:string}|null};

export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const search=request.nextUrl.searchParams;
 const at=search.get("beforeAt"),id=search.get("beforeId");
 if(Boolean(at)!==Boolean(id)||id&&!uuid(id)||at&&(!/^\d{4}-\d\d-\d\dT/.test(at)||Number.isNaN(Date.parse(at))))
  return connectFailure("Invalid pagination cursor.",400);
 const rawLimit=search.get("limit")||"40";
 if(!/^\d{1,3}$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>100)
  return connectFailure("Invalid page limit.",400);
 const session=await connectSession(request);
 if(!isConnectSession(session))return session;
 const result=await invokeConnect<Page>(session,"connect_unified_threads",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_limit:Number(rawLimit),
  p_before_at:at||null,p_before_id:id||null
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,items:result.data?.items||[],nextCursor:result.data?.nextCursor||null},{headers:noStore});
}
