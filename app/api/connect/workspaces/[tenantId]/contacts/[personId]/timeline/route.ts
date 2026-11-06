import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";

export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string;personId:string}>};
type Event={id:string;kind:string;title:string;detail:string;at:string;status:string|null};
type Result={items:Event[];nextCursor:{at:string;key:string}|null};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId,personId}=await params;
 if(!uuid(tenantId)||!uuid(personId))return connectFailure("Invalid workspace or contact.",400);
 const at=request.nextUrl.searchParams.get("beforeAt");
 const key=request.nextUrl.searchParams.get("beforeKey");
 if(Boolean(at)!==Boolean(key)||key&&(!/^(enquiry|activity|admission|stage|task|taskdone|appointment|message):[0-9a-f-]{36}$/i.test(key)))
  return connectFailure("Invalid timeline cursor.",400);
 if(at&&(!/^\d{4}-\d\d-\d\dT/.test(at)||Number.isNaN(Date.parse(at))))
  return connectFailure("Invalid timeline timestamp.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 // SQL function verifies active tenant membership and contact tenancy before reading any events.
 const result=await invokeConnect<Result>(auth,"connect_contact_timeline",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_person_id:personId,
  p_before_at:at||null,p_before_key:key||null,p_limit:40
 });
 if(result.error){
  if(result.code==="PGRST202"||result.code==="42883")return connectFailure("Contact timeline is not yet enabled in this environment.",503);
  return connectRpcFailure(result.error,result.code);
 }
 return NextResponse.json({ok:true,items:result.data?.items||[],nextCursor:result.data?.nextCursor||null},{headers:noStore});
}
