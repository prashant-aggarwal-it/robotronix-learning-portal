import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
function readCursor(request:NextRequest){
 const at=request.nextUrl.searchParams.get("beforeAt"),id=request.nextUrl.searchParams.get("beforeId");
 if(Boolean(at)!==Boolean(id)||id&&!uuid(id)||at&&(!/^\d{4}-\d\d-\d\dT/.test(at)||Number.isNaN(Date.parse(at))))
  return {error:"Invalid pagination cursor."};
 const rawLimit=request.nextUrl.searchParams.get("limit")||"40";
 if(!/^\d{1,3}$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>100)return {error:"Invalid page limit."};
 return {at:at||null,id:id||null,limit:Number(rawLimit)};
}
type Ctx={params:Promise<{tenantId:string}>};
type Response={items:unknown[];nextCursor:{at:string;id:string}|null};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const cursor=readCursor(request);
 if(cursor.error)return connectFailure(cursor.error,400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const r=await invokeConnect<Response>(auth,"connect_whatsapp_threads",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_limit:cursor.limit,
  p_before_at:cursor.at,p_before_id:cursor.id
 });
 if(r.error)return connectRpcFailure(r.error,r.code);
 return NextResponse.json({ok:true,items:r.data?.items||[],nextCursor:r.data?.nextCursor||null},{headers:noStore});
}
