import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string;personId:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId,personId}=await params;
 if(!uuid(tenantId)||!uuid(personId))return connectFailure("Invalid contact reference.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const result=await invokeConnect<{consent:string;sources:unknown[]}>(session,"connect_contact_import_profile",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_person_id:personId
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,...(result.data||{consent:"unknown",sources:[]})},{headers:noStore});
}