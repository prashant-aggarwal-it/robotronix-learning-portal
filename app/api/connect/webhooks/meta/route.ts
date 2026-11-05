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
type GraphLead={id?:string;field_data?:Array<{name?:string;values?:unknown[]}>};
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
     const id=safeString(msg.id,250),waId=safeString(msg.from,35);
     const content=msg.type==="text"?safeString(msg.text?.body,2000):
       msg.type==="button"?safeString(msg.button?.text,2000):
       msg.type==="interactive"?safeString(msg.interactive?.button_reply?.title||
         msg.interactive?.list_reply?.title,2000):"";
     if(!phoneId||!id||!waId||!content){ignored++;continue;}
     try{
      const result:any=await invokeIngest("connect_ingest_channel",{
       p_provider:"whatsapp",p_external_account_id:phoneId,p_event_id:id,
       p_name:profiles.get(waId)||"WhatsApp contact",p_email:null,
       p_phone:"+"+waId.replace(/\D/g,""),p_summary:content
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
