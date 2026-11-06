import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
import {metaTestReady,sendMetaTestText} from "@/lib/server/connect-meta-test";
export const dynamic="force-dynamic";
export const runtime="nodejs";
type Ctx={params:Promise<{tenantId:string;conversationId:string}>};
type Eligibility={canReply:boolean;phoneNumberId?:string;recipient?:string;reason?:string|null;lastInboundAt?:string|null};
type Reserve={id:string;isNew:boolean;state:string;phoneNumberId?:string;destination?:string};
async function context(req:NextRequest,tenantId:string,conversationId:string){
 const session=await connectSession(req);if(!isConnectSession(session))return {response:session};
 const result=await invokeConnect<Eligibility>(session,"connect_whatsapp_test_reply_context",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId
 });
 if(result.error)return {response:connectRpcFailure(result.error,result.code)};
 return {session,eligibility:result.data};
}
export async function GET(req:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const auth=await context(req,tenantId,conversationId);
 if(auth.response)return auth.response;
 const eligibility=auth.eligibility;
 const configured=Boolean(eligibility?.phoneNumberId&&eligibility?.recipient&&metaTestReady(eligibility.phoneNumberId,eligibility.recipient));
 const canSend=Boolean(configured&&eligibility?.canReply);
 return NextResponse.json({
  ok:true,canSend,testMode:configured,reason:canSend?null:
   !configured?"Meta test sender or recipient is not configured for this conversation.":
    eligibility?.reason||"Reply window is not open.",
  lastInboundAt:eligibility?.lastInboundAt||null
 },{headers:noStore});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const {tenantId,conversationId}=await params;
 if(!uuid(tenantId)||!uuid(conversationId))return connectFailure("Invalid workspace or conversation.",400);
 const raw:unknown=await req.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return connectFailure("Invalid send request.",400);
 const body=raw as Record<string,unknown>;
 if(!uuid(body.clientRequestId)||typeof body.text!=="string"||!body.text.trim()||body.text.length>3000)
  return connectFailure("Enter a message of up to 3000 characters.",400);
 const auth=await context(req,tenantId,conversationId);
 if(auth.response)return auth.response;
 const eligibility=auth.eligibility;
 if(!eligibility?.canReply)return connectFailure("The WhatsApp customer-service reply window is not open.",409);
 if(!eligibility.phoneNumberId||!eligibility.recipient||!metaTestReady(eligibility.phoneNumberId,eligibility.recipient))
  return connectFailure("Meta test messaging is not configured for this sender and recipient.",503);
 const session=auth.session!;
 // Reserve first, so repeated client request IDs never duplicate a provider send.
 const reservation=await invokeConnect<Reserve>(session,"connect_whatsapp_reserve_test_send",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_conversation_id:conversationId,
  p_client_request_id:body.clientRequestId,p_body:body.text
 });
 if(reservation.error)return connectRpcFailure(reservation.error,reservation.code);
 const saved=reservation.data;
 if(!saved?.id)return connectFailure("Unable to reserve send.",503);
 if(!saved.isNew)return connectFailure("This send request was already submitted. Refresh the conversation to check delivery.",409);
 if(saved.phoneNumberId!==eligibility.phoneNumberId||saved.destination!==eligibility.recipient)
  return connectFailure("Sender or recipient changed. Refresh before sending.",409);
 const outcome=await sendMetaTestText(saved.phoneNumberId,saved.destination,body.text.trim());
 const finished=await invokeConnect<{ok:boolean;state:string;messageId?:string}>(session,"connect_whatsapp_complete_test_send",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_request_id:saved.id,
  p_state:outcome.outcome,p_message_id:outcome.outcome==="accepted"?outcome.messageId:null,
  p_failure_code:outcome.outcome==="accepted"?null:outcome.failureCode
 });
 if(finished.error)return connectFailure("Provider result could not be recorded; the message may have been accepted. Do not resend without checking the conversation.",503);
 if(outcome.outcome==="unknown")return connectFailure("Meta did not provide a definite result. Check the conversation before trying again.",503);
 if(outcome.outcome==="rejected")return connectFailure("Meta rejected this test message. Verify your test recipient and token.",502);
 return NextResponse.json({ok:true,state:"accepted",messageId:outcome.messageId,
  note:"Meta accepted the message. Delivery and read confirmations arrive by webhook."},{headers:noStore});
}
