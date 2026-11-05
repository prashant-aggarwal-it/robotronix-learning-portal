import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest,context:{params:Promise<{tenantId:string}>}){
 const {tenantId}=await context.params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace ID.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid invitation request.",400);
 const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
 const role=typeof body.role==="string"?body.role:"";
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["admin","manager","counsellor","viewer"].includes(role))
  return connectFailure("Provide a valid email and staff role.",400);
 const token=crypto.randomBytes(32).toString("base64url");
 const hash=crypto.createHash("sha256").update(token).digest("hex");
 const result=await invokeConnect<string>(auth,"connect_create_invitation",{p_actor_id:auth.actorId,p_tenant_id:tenantId,p_email:email,p_role:role,p_token_sha256:hash});
 if(result.error)return connectRpcFailure(result.error,result.code);
 // No email provider is configured: caller must securely deliver the one-time token to the intended user.
 return NextResponse.json({ok:true,invitationId:result.data,acceptToken:token,expiresInDays:7,delivery:"manual_secure_share"},{status:201,headers:noStore});
}
