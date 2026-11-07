import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
export const runtime="nodejs";
type Ctx={params:Promise<{tenantId:string;conversationId:string}>};
type Details={provider:string};
type Context={canReply:boolean;provider?:string;accountId?:string;recipient?:string;sender?:string;subject?:string;inReplyTo?:string|null};
type Reservation={reservationId:string;provider?:string;accountId?:string;recipient?:string;sender?:string};
function graphVersion(){const v=process.env.CONNECT_META_GRAPH_VERSION||"v26.0";return /^v\d+\.\d+$/.test(v)?v:null;}
function config(provider:string){
 if(provider==="email")return process.env.CONNECT_EMAIL_REPLY_ENABLED==="true"&&Boolean(process.env.CONNECT_RESEND_API_KEY);
 return process.env.CONNECT_SOCIAL_REPLY_ENABLED==="true"&&Boolean(process.env.CONNECT_META_GRAPH_ACCESS_TOKEN&&graphVersion());
}
async function send(provider:string,ctx:Context,res:Reservation,body:string):Promise<string|null>{
 if(provider==="email"){
  const token=process.env.CONNECT_RESEND_API_KEY;
  if(!token||!res.sender||!res.recipient||res.sender!==ctx.sender||res.recipient!==ctx.recipient)return null;
  const subject=(ctx.subject||"Robotronix enquiry").slice(0,250);
  const replySubject=/^re:/i.test(subject)?subject:"Re: "+subject;
  const headers:Record<string,string>={};
  if(ctx.inReplyTo&&/^<[^\r\n<>]+>$/.test(ctx.inReplyTo))headers["In-Reply-To"]=ctx.inReplyTo;
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","Idempotency-Key":res.reservationId},
   body:JSON.stringify({from:res.sender,to:[res.recipient],subject:replySubject,text:body,...(Object.keys(headers).length?{headers}:{})}),
   signal:AbortSignal.timeout(12000),cache:"no-store"
  });
  if(!response.ok)return null;
  const data:unknown=await response.json().catch(()=>null);
  const id=(data&&typeof data==="object"&&"id" in data)?(data as {id?:unknown}).id:null;
  return typeof id==="string"&&id.length>=3&&id.length<=250?id:null;
 }
 const token=process.env.CONNECT_META_GRAPH_ACCESS_TOKEN,version=graphVersion();
 if(!token||!version||!res.accountId||!res.recipient||res.accountId!==ctx.accountId||res.recipient!==ctx.recipient)return null;
 const url="https://graph.facebook.com/"+version+"/"+encodeURIComponent(res.accountId)+"/messages";
 const response=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({recipient:{id:res.recipient},messaging_type:"RESPONSE",message:{text:body}}),
  signal:AbortSignal.timeout(12000),cache:"no-store"});
 if(!response.ok)return null;
 const data:unknown=await response.json().catch(()=>null);
 const id=(data&&typeof data==="object"&&"message_id" in data)?(data as {message_id?:unknown}).message_id:null;
 return typeof id==="string"&&id.length>=3&&id.length<=250?id:null;
}
export async function POST(request:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid reply.",400);
 const input=body as Record<string,unknown>;
 if(!uuid(input.clientRequestId)||typeof input.text!=="string"||!input.text.trim()||input.text.length>12000)
  return connectFailure("Invalid message or request ID.",400);
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const detail=await invokeConnect<Details>(session,"connect_unified_conversation",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId});
 if(detail.error)return connectRpcFailure(detail.error,detail.code);
 const provider=detail.data?.provider;
 if(!provider||!["email","instagram","facebook"].includes(provider))return connectFailure("Unsupported reply channel.",400);
 if(provider!=="email"&&input.text.length>1000)return connectFailure("Social reply must be at most 1000 characters.",400);
 if(!config(provider))return connectFailure("Sending credentials are not configured.",503);
 const fn=provider==="email"?"connect_unified_email_reply":"connect_social_reply";
 const args={p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId};
 const context=await invokeConnect<Context>(session,fn,{...args,p_action:"context"});
 if(context.error)return connectRpcFailure(context.error,context.code);
 if(!context.data?.canReply)return connectFailure("Replies are not permitted for this conversation.",409);
 const reserved=await invokeConnect<Reservation>(session,fn,{...args,p_action:"reserve",p_request_id:input.clientRequestId,p_body:input.text.trim()});
 if(reserved.error)return connectRpcFailure(reserved.error,reserved.code);
 if(!reserved.data?.reservationId)return connectFailure("Could not reserve the reply.",503);
 let messageId:string|null=null;
 try{messageId=await send(provider,context.data,reserved.data,input.text.trim());}catch{
  // A timeout may mean the provider accepted the message. Never auto-retry it.
 }
 const finished=await invokeConnect<unknown>(session,fn,{...args,p_action:"complete",p_request_id:input.clientRequestId,p_message_id:messageId});
 if(finished.error)return connectFailure("Provider outcome could not be recorded. Check the conversation before trying again.",503);
 if(!messageId)return connectFailure("Provider did not confirm acceptance. Do not resend without checking the provider.",502);
 return NextResponse.json({ok:true,state:"accepted",messageId,note:"Provider accepted the reply; delivery confirmation may arrive later."},{headers:noStore});
}
