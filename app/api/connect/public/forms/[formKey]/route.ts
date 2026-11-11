import {requireServerCapability} from "@/lib/platform/server-access";
import crypto from "node:crypto";
import {NextRequest} from "next/server";
import {acceptedEvent,intakeError,invokeIngest,safeString} from "@/lib/server/connect-ingestion";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{formKey:string}>};
function allowedOrigin(req:NextRequest){
 const origin=req.headers.get("origin");
 if(!origin)return null;
 const allowed=(process.env.CONNECT_FORM_ALLOWED_ORIGINS||"").split(",").map(s=>s.trim()).filter(Boolean);
 return origin===req.nextUrl.origin||allowed.includes(origin)?origin:false;
}
function withCors<T extends Response>(response:T,origin:string|null|false):T{
 if(typeof origin==="string"){response.headers.set("Access-Control-Allow-Origin",origin);response.headers.set("Vary","Origin");}
 return response;
}
export async function OPTIONS(req:NextRequest){
 const blocked=requireServerCapability("crm");if(blocked)return blocked;
 const origin=allowedOrigin(req);
 if(origin===false)return new Response(null,{status:403});
 return withCors(new Response(null,{status:204,headers:{
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type",
  "Access-Control-Max-Age":"600","Cache-Control":"no-store"
 }}),origin);
}
export async function POST(req:NextRequest,{params}:Ctx){
 const blocked=requireServerCapability("crm");if(blocked)return blocked;
 const origin=allowedOrigin(req);
 if(origin===false)return withCors(intakeError("Website origin not permitted",403),origin);
 const {formKey}=await params;
 if(!/^[A-Za-z0-9_-]{40,64}$/.test(formKey))return withCors(intakeError("Form unavailable",404),origin);
 if(process.env.CONNECT_PUBLIC_FORMS_ENABLED!=="true"||
    !process.env.CONNECT_TURNSTILE_SECRET)return withCors(intakeError("Public forms are not enabled",503),origin);
 if(Number(req.headers.get("content-length")||0)>8192)return withCors(intakeError("Request too large",413),origin);
 const raw=await req.text();
 if(Buffer.byteLength(raw,"utf8")>8192)return withCors(intakeError("Request too large",413),origin);
 const body:unknown=(()=>{try{return JSON.parse(raw)}catch{return null}})();
 if(!body||typeof body!=="object"||Array.isArray(body))return withCors(intakeError("Invalid form",400),origin);
 const b=body as Record<string,unknown>;
 // Honeypot: do not store spam or reveal a filtering signal.
 if(safeString(b.website_url))return withCors(acceptedEvent({accepted:true}),origin);
 const turnstile=safeString(b.turnstileToken,2048);
 if(!turnstile)return withCors(intakeError("Form verification required",400),origin);
 // Fail closed; no CRM write when verification provider is unavailable.
 try{
  const form=new URLSearchParams({secret:process.env.CONNECT_TURNSTILE_SECRET,response:turnstile});
  const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
   method:"POST",body:form,signal:AbortSignal.timeout(8000),cache:"no-store"
  });
  if(!response.ok)return withCors(intakeError("Form verification unavailable",503),origin);
  const verdict=await response.json() as {success?:boolean};
  if(!verdict.success)return withCors(intakeError("Form verification failed",403),origin);
 }catch{return withCors(intakeError("Form verification unavailable",503),origin);}
 if(b.consent!==true)return withCors(intakeError("Please confirm consent to submit this enquiry",400),origin);
 const name=safeString(b.name,151),email=safeString(b.email,255),phone=safeString(b.phone,36);
 const summary=safeString(b.message,2001),eventId=safeString(b.eventId,100);
 if(name.length<2||(!email&&!phone)||summary.length>2000||
    !/^[0-9a-f-]{36}$/i.test(eventId))return withCors(intakeError("Check the enquiry details",400),origin);
 const hash=crypto.createHash("sha256").update(formKey).digest("hex");
 try{
  const result=await invokeIngest("connect_ingest_website",{
   p_token_hash:hash,p_event_id:eventId,p_name:name,p_email:email||null,p_phone:phone||null,p_summary:summary||null
  });
  return withCors(acceptedEvent(result),origin);
 }catch{return withCors(intakeError("Unable to capture this enquiry. Please retry.",503),origin);}
}
