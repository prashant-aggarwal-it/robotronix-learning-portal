import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string;personId:string}>};
type Data={people:unknown[];organizations:unknown[];owner:unknown;members:unknown[];organizationOptions:unknown[];peopleOptions:unknown[]};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId,personId}=await params;
 if(!uuid(tenantId)||!uuid(personId))return connectFailure("Invalid contact or workspace.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const r=await invokeConnect<Data>(auth,"connect_contact_relations",{p_actor_id:auth.actorId,p_tenant_id:tenantId,p_person_id:personId});
 if(r.error)return connectRpcFailure(r.error,r.code);
 return NextResponse.json({ok:true,...r.data},{headers:noStore});
}
const actions=new Set(["link_person","unlink_person","link_organization","unlink_organization","assign_owner"]);
export async function POST(request:NextRequest,{params}:Ctx){
 const {tenantId,personId}=await params;
 if(!uuid(tenantId)||!uuid(personId))return connectFailure("Invalid contact or workspace.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const payload:unknown=await request.json().catch(()=>null);
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return connectFailure("Invalid request.",400);
 const body=payload as Record<string,unknown>;
 if(typeof body.action!=="string"||!actions.has(body.action)||!body.data||typeof body.data!=="object"||Array.isArray(body.data)||JSON.stringify(body.data).length>1500)
  return connectFailure("Invalid relationship action.",400);
 const r=await invokeConnect<{ok:boolean}>(auth,"connect_contact_relation_command",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_person_id:personId,p_action:body.action,p_data:body.data
 });
 if(r.error)return connectRpcFailure(r.error,r.code);
 return NextResponse.json(r.data??{ok:true},{headers:noStore});
}
