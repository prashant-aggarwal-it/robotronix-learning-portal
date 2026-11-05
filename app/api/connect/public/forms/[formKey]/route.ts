import crypto from "node:crypto";
import {NextRequest} from "next/server";
import {acceptedEvent,intakeError,invokeIngest,safeString} from "@/lib/server/connect-ingestion";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{formKey:string}>};
export async function POST(req:NextRequest,{params}:Ctx){
 const {formKey}=await params;
 if(!/^[A-Za-z0-9_-]{40,64}$/.test(formKey))return intakeError("Form unavailable",404);
 if(process.env.CONNECT_PUBLIC_FORMS_ENABLED!=="true"||
    !process.env.CONNECT_TURNSTILE_SECRET)return intakeError("Public forms are not enabled",503);
 if(Number(req.headers.get("content-length")||0)>8192)return intakeError("Request too large",413);
 const raw=await req.text();
 if(Buffer.byteLength(raw,"utf8")>8192)return intakeError("Request too large",413);
 const body:unknown=(()=>{try{return JSON.parse(raw)}catch{return null}})();
 if(!body||typeof body!=="object"||Array.isArray(body))return intakeError("Invalid form",400);
 const b=body as Record<string,unknown>;
 // Honeypot: do not store spam or reveal a filtering signal.
 if(safeString(b.website_url))return acceptedEvent({accepted:true});
 const turnstile=safeString(b.turnstileToken,2048);
 if(!turnstile)return intakeError("Form verification required",400);
 // Fail closed; no CRM write when verification provider is unavailable.
 try{
  const form=new URLSearchParams({secret:process.env.CONNECT_TURNSTILE_SECRET,response:turnstile});
  const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
   method:"POST",body:form,signal:AbortSignal.timeout(8000),cache:"no-store"
  });
  if(!response.ok)return intakeError("Form verification unavailable",503);
  const verdict=await response.json() as {success?:boolean};
  if(!verdict.success)return intakeError("Form verification failed",403);
 }catch{return intakeError("Form verification unavailable",503);}
 const name=safeString(b.name,151),email=safeString(b.email,255),phone=safeString(b.phone,36);
 const summary=safeString(b.message,2001),eventId=safeString(b.eventId,100);
 if(name.length<2||(!email&&!phone)||summary.length>2000||
    !/^[0-9a-f-]{36}$/i.test(eventId))return intakeError("Check the enquiry details",400);
 const hash=crypto.createHash("sha256").update(formKey).digest("hex");
 try{
  const result=await invokeIngest("connect_ingest_website",{
   p_token_hash:hash,p_event_id:eventId,p_name:name,p_email:email||null,p_phone:phone||null,p_summary:summary||null
  });
  return acceptedEvent(result);
 }catch{return intakeError("Unable to capture this enquiry. Please retry.",503);}
}
