import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
export const runtime="nodejs";
type Ctx={params:Promise<{tenantId:string;conversationId:string}>};
type Attachment={emailId:string;attachmentId:string;filename:string};
export async function POST(request:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid attachment request.",400);
 const input=body as Record<string,unknown>;
 if(!uuid(input.messageId)||typeof input.attachmentId!=="string"||input.attachmentId.length<3||input.attachmentId.length>250)
  return connectFailure("Invalid attachment.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const result=await invokeConnect<Attachment>(session,"connect_email_attachment_context",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId,
  p_message_id:input.messageId,p_attachment_id:input.attachmentId});
 if(result.error)return connectRpcFailure(result.error,result.code);
 const context=result.data;
 if(!context?.emailId||context.attachmentId!==input.attachmentId)return connectFailure("Attachment unavailable.",404);
 const key=process.env.CONNECT_RESEND_API_KEY;
 if(!key)return connectFailure("Email attachment retrieval is not configured.",503);
 const response=await fetch("https://api.resend.com/emails/receiving/"+encodeURIComponent(context.emailId)+"/attachments/"+encodeURIComponent(context.attachmentId),{
  headers:{Authorization:"Bearer "+key},cache:"no-store",signal:AbortSignal.timeout(10000)
 }).catch(()=>null);
 if(!response?.ok)return connectFailure("Attachment provider unavailable.",502);
 const value:unknown=await response.json().catch(()=>null);
 if(!value||typeof value!=="object"||!("download_url" in value))return connectFailure("Attachment link unavailable.",502);
 const url=(value as {download_url:unknown}).download_url;
 if(typeof url!=="string")return connectFailure("Invalid attachment link.",502);
 let parsed:URL;try{parsed=new URL(url);}catch{return connectFailure("Invalid attachment link.",502);}
 if(parsed.protocol!=="https:"||parsed.username||parsed.password)return connectFailure("Unsafe attachment link.",502);
 // Short-lived provider-signed URL; never cache or expose provider API credentials.
 return NextResponse.json({ok:true,url:parsed.toString(),filename:context.filename},{headers:noStore});
}
