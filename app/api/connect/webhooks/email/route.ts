import {NextRequest} from "next/server";
import {acceptedEvent,intakeError,invokeIngest,readRawLimited,verifySvix,safeString} from "@/lib/server/connect-ingestion";
export const runtime="nodejs";
export const dynamic="force-dynamic";

function mailbox(value:string){
 const match=value.match(/<([^<>\s]+@[^<>\s]+)>/);
 return (match?.[1]||value).trim().toLowerCase();
}
function senderName(value:string){
 const name=value.replace(/<[^<>]*>/g,"").replace(/^["']|["']$/g,"").trim();
 return name||mailbox(value).split("@")[0]||"Email contact";
}
export async function POST(req:NextRequest){
 const secret=process.env.CONNECT_RESEND_WEBHOOK_SECRET;
 if(!secret)return intakeError("Inbound email is not configured",503);
 const raw=await readRawLimited(req,64000);
 if(raw===null)return intakeError("Payload too large",413);
 if(!verifySvix(raw,req.headers,secret))return intakeError("Invalid email webhook signature",401);
 let event:any;
 try{event=JSON.parse(raw);}catch{return intakeError("Invalid email webhook event",400);}
 // Resend inbound email webhooks contain metadata; the body requires a separate
 // Receiving API call. Only sender, recipient and subject are ingested here.
 if(event?.type!=="email.received"&&event?.type!=="inbox.email.received")
  return acceptedEvent({ignored:true});
 const data=event.data||{},emailId=safeString(data.email_id,250);
 const from=safeString(data.from,350);
 const recipients=Array.isArray(data.to)?data.to:[data.to].filter(Boolean);
 if(!emailId||!from||!recipients.length)return intakeError("Incomplete email metadata",400);
 let processed=0,duplicates=0,failed=0;
 const token=process.env.CONNECT_RESEND_API_KEY;
 if(!token)return intakeError("Inbound email content retrieval is not configured",503);
 const received=await fetch("https://api.resend.com/emails/receiving/"+encodeURIComponent(emailId),{
  headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(10000)
 }).catch(()=>null);
 if(!received?.ok)return intakeError("Unable to retrieve inbound email content",503);
 const full:any=await received.json().catch(()=>null);
 if(!full||typeof full!=="object"||full.id!==emailId)return intakeError("Invalid received email",503);
 const body=safeString(full.text,15000)||"";
 const attachments=Array.isArray(full.attachments)?full.attachments.slice(0,20).map((a:any)=>({
  id:safeString(a.id,250),filename:safeString(a.filename,255),
  contentType:safeString(a.content_type,150),size:typeof a.size==="number"&&a.size>=0?Math.floor(a.size):null
 })):[];
 const messageHeader=safeString(full.message_id,250)||null;
 for(const rawTo of recipients.slice(0,10)){
  const to=mailbox(safeString(rawTo,350));
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){failed++;continue;}
  try{
   const result:any=await invokeIngest("connect_ingest_email_thread",{
    p_mailbox:to,p_event_id:emailId,p_sender_email:mailbox(from),
    p_sender_name:senderName(from).slice(0,150),
    p_subject:safeString(full.subject||data.subject,1500)||"New inbound email enquiry"
   });
   await invokeIngest("connect_enrich_inbound_email",{
    p_mailbox:to,p_event_id:emailId,p_body:body,p_attachments:attachments,
    p_header_message_id:messageHeader,p_subject:safeString(full.subject||data.subject,250),
    p_sender_email:mailbox(from)
   });
   if(result?.duplicate)duplicates++;else processed++;
  }catch{failed++;}
 }
 // Let Resend retry if one mapped inbox failed; idempotency protects the others.
 if(failed)return intakeError("Email delivery could not be processed",503);
 return acceptedEvent({processed,duplicates});
}
