import {NextRequest,NextResponse} from "next/server";
import {acceptedEvent,intakeError,checkHmacSha256,equalSecret,
 readRawLimited,invokeIngest,safeString} from "@/lib/server/connect-ingestion";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 const p=req.nextUrl.searchParams;
 const valid=p.get("hub.mode")==="subscribe"&&equalSecret(
  p.get("hub.verify_token"),process.env.CONNECT_META_VERIFY_TOKEN
 );
 const challenge=p.get("hub.challenge");
 if(!valid||!challenge)return new NextResponse("Forbidden",{status:403});
 return new NextResponse(challenge,{status:200,headers:{"Content-Type":"text/plain","Cache-Control":"no-store"}});
}
function validMetaTime(value:unknown):string|null{\n const time=typeof value==="string"&&/^\\d{10,11}$/.test(value)?Number(value):NaN;\n if(!Number.isFinite(time)||time<946684800||time>Date.now()/1000+86400)return null;\n return new Date(time*1000).toISOString();\n}\nfunction messageParts(msg:any){\n const kind=safeString(msg?.type,40)||"unknown";\n const body=kind==="text"?safeString(msg?.text?.body,3000):\n  kind==="button"?safeString(msg?.button?.text,3000):\n  kind==="interactive"?safeString(msg?.interactive?.button_reply?.title||msg?.interactive?.list_reply?.title,3000):\n  kind==="reaction"?safeString(msg?.reaction?.emoji,100):\n  kind==="location"?safeString(msg?.location?.name||msg?.location?.address,300):\n  safeString(msg?.[kind]?.caption,3000);\n const media=["image","video","audio","document","sticker"].includes(kind)?msg?.[kind]:null;\n return {kind,body,mediaId:safeString(media?.id,250)||null,mimeType:safeString(media?.mime_type,150)||null,\n  filename:safeString(media?.filename,255)||null,replyToId:safeString(msg?.context?.id,250)||null};\n}\ntype GraphLead={id?:string;field_data?:Array<{name?:string;values?:unknown[]}>};
function extractLead(data:GraphLead){
 const fields=new Map<string,string>();
 for(const field of data.field_data||[]){
  if(field.name&&field.values?.length)fields.set(field.name.toLowerCase(),
    safeString(field.values[0],350));
 }
 const name=fields.get("full_name")||
  [fields.get("first_name"),fields.get("last_name")].filter(Boolean).join(" ")||
  fields.get("name")||"Meta lead";
 return {name,email:fields.get("email")||null,phone:fields.get("phone_number")||null,
  summary:Array.from(fields.entries())
   .filter(([k])=>!["email","phone_number","full_name","first_name","last_name","name"].includes(k))
   .slice(0,12).map(([k,v])=>k.replaceAll("_"," ")+": "+v).join("; ").slice(0,2000)||"New Meta Lead Ads enquiry"};
}
async function fetchLead(leadId:string):Promise<GraphLead>{
 const token=process.env.CONNECT_META_GRAPH_ACCESS_TOKEN;
 const version=process.env.CONNECT_META_GRAPH_VERSION||"v23.0";
 if(!token||!/^[a-zA-Z0-9_.-]{6,250}$/.test(leadId)||!/^v\d+\.\d+$/.test(version))
  throw new Error("Meta Graph lead retrieval unavailable");
 const url=new URL("https://graph.facebook.com/"+version+"/"+encodeURIComponent(leadId));
 url.searchParams.set("fields","id,field_data");
 const response=await fetch(url,{headers:{Authorization:"Bearer "+token},
  cache:"no-store",signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw new Error("Meta Graph API lead fetch failed");
 return await response.json() as GraphLead;
}
export async function POST(req:NextRequest){
 const secret=process.env.CONNECT_META_APP_SECRET;
 if(!secret)return intakeError("Meta integration unavailable",503);
 const raw=await readRawLimited(req,128000);
 if(raw===null)return intakeError("Payload too large",413);
 if(!checkHmacSha256(raw,req.headers.get("x-hub-signature-256"),secret))
  return intakeError("Invalid webhook signature",401);
 let payload:any;
 try{payload=JSON.parse(raw);}catch{return intakeError("Invalid webhook payload",400);}
 if(!payload||!Array.isArray(payload.entry))return intakeError("Invalid webhook event",400);
 let processed=0,duplicate=0,ignored=0,failures=0;
 // Meta delivers event batches. Unknown/status events are not new enquiries.
 for(const entry of payload.entry.slice(0,30)){
  for(const change of (Array.isArray(entry.changes)?entry.changes:[]).slice(0,50)){
   const value=change?.value;
   if(change.field==="messages"||Array.isArray(value?.messages)){
    const phoneId=safeString(value?.metadata?.phone_number_id,200);
    const profiles=new Map<string,string>();
    for(const c of (Array.isArray(value?.contacts)?value.contacts:[]))
     profiles.set(String(c.wa_id||""),safeString(c.profile?.name,150));
    for(const msg of (Array.isArray(value?.messages)?value.messages:[]).slice(0,50)){
     const id=safeString(msg?.id,250),waId=safeString(msg?.from,35);
     if(!phoneId||!id||!waId){ignored++;continue;}
     const parts=messageParts(msg);
     try{
      const result:any=await invokeIngest("connect_ingest_whatsapp_message",{
       p_external_account_id:phoneId,p_message_id:id,p_contact_wa_id:waId,
       p_contact_name:profiles.get(waId)||"WhatsApp contact",p_kind:parts.kind,
       p_body:parts.body,p_occurred_at:validMetaTime(msg?.timestamp),
       p_media_id:parts.mediaId,p_media_mime_type:parts.mimeType,
       p_media_filename:parts.filename,p_reply_to_id:parts.replyToId,p_direction:"inbound"
      });
      if(result?.duplicate)duplicate++;else processed++;
     }catch{failures++;}
    }
    for(const status of (Array.isArray(value?.statuses)?value.statuses:[]).slice(0,50)){
     const id=safeString(status?.id,250),state=safeString(status?.status,30);
     if(!phoneId||!id||!["sent","delivered","read","failed"].includes(state)){ignored++;continue;}
     try{
      await invokeIngest("connect_ingest_whatsapp_status",{
       p_external_account_id:phoneId,p_message_id:id,p_status:state,
       p_occurred_at:validMetaTime(status?.timestamp),
       p_failure_reason:safeString(status?.errors?.[0]?.title||status?.errors?.[0]?.message,500)||null
      });processed++;
     }catch{failures++;}
    }
    continue;
   }
   // Business App coexistence: echo is outbound and uses the recipient as the contact.
   if(change.field==="smb_message_echoes"){
    const phoneId=safeString(value?.metadata?.phone_number_id,200);
    for(const msg of (Array.isArray(value?.message_echoes)?value.message_echoes:[]).slice(0,50)){
     const id=safeString(msg?.id,250),waId=safeString(msg?.to,35);
     if(!phoneId||!id||!waId){ignored++;continue;}
     const parts=messageParts(msg);
     try{
      const result:any=await invokeIngest("connect_ingest_whatsapp_message",{
       p_external_account_id:phoneId,p_message_id:id,p_contact_wa_id:waId,
       p_contact_name:"WhatsApp contact",p_kind:parts.kind,p_body:parts.body,
       p_occurred_at:validMetaTime(msg?.timestamp),p_media_id:parts.mediaId,
       p_media_mime_type:parts.mimeType,p_media_filename:parts.filename,
       p_reply_to_id:parts.replyToId,p_direction:"outbound"
      });
      if(result?.duplicate)duplicate++;else processed++;
     }catch{failures++;}
    }
    continue;
   }
   if(change.field==="leadgen"){
    const leadId=safeString(value?.leadgen_id,250);
    const pageId=safeString(value?.page_id||entry.id,200);
    if(!leadId||!pageId){ignored++;continue;}
    try{
     const lead=extractLead(await fetchLead(leadId));
     const result:any=await invokeIngest("connect_ingest_channel",{
      p_provider:"meta_leads",p_external_account_id:pageId,p_event_id:leadId,
      p_name:lead.name,p_email:lead.email,p_phone:lead.phone,p_summary:lead.summary
     });
     if(result?.duplicate)duplicate++;else processed++;
    }catch{failures++;}
    continue;
   }
   ignored++;
  }
 }
 // Do not acknowledge failed valid events as successful: Meta retries. Completed
 // individual events are idempotent and will be skipped on the retry.
 if(failures)return intakeError("Some events could not be processed; retry delivery",503);
 return acceptedEvent({processed,duplicate,ignored});
}
