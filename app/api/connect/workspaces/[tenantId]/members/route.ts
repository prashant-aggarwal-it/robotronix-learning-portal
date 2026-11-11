import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest,context:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await context.params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace ID.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<Array<{member_id:string;member_user_id:string;member_role:string;member_status:string;member_created_at:string}>>(auth,"connect_workspace_members",{p_actor_id:auth.actorId,p_tenant_id:tenantId});
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,members:result.data||[]},{headers:noStore});
}
