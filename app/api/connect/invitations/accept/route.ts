import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const body=await request.json().catch(()=>null);
 const token=body&&typeof body.token==="string"?body.token:"";
 if(!/^[\w-]{40,64}$/.test(token))return connectFailure("Invalid invitation token.",400);
 if(!auth.actorEmail)return connectFailure("Your account needs a verified email address.",403);
 const hash=crypto.createHash("sha256").update(token).digest("hex");
 const result=await invokeConnect<string>(auth,"connect_accept_invitation",{p_actor_id:auth.actorId,p_actor_email:auth.actorEmail,p_token_sha256:hash});
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,workspaceId:result.data},{headers:noStore});
}
