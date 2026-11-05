import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
export async function DELETE(request:NextRequest,context:{params:Promise<{tenantId:string;invitationId:string}>}){
 const {tenantId,invitationId}=await context.params;
 if(!uuid(tenantId)||!uuid(invitationId))return connectFailure("Invalid identifier.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<boolean>(auth,"connect_revoke_invitation",{p_actor_id:auth.actorId,p_tenant_id:tenantId,p_invitation_id:invitationId});
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,revoked:Boolean(result.data)},{headers:noStore});
}
