import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
export async function PATCH(request:NextRequest,context:{params:Promise<{tenantId:string;memberId:string}>}){
 const {tenantId,memberId}=await context.params;
 if(!uuid(tenantId)||!uuid(memberId))return connectFailure("Invalid member or workspace identifier.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid member update.",400);
 const role=typeof body.role==="string"?body.role:"";
 const status=typeof body.status==="string"?body.status:"";
 if(!["owner","admin","manager","counsellor","viewer"].includes(role)||!["active","disabled"].includes(status))
  return connectFailure("Provide a valid role and status.",400);
 const result=await invokeConnect<boolean>(auth,"connect_update_member",{p_actor_id:auth.actorId,p_tenant_id:tenantId,p_member_id:memberId,p_role:role,p_status:status});
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,updated:Boolean(result.data)},{headers:noStore});
}
