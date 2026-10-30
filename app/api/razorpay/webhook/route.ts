import {logSystemEvent} from "@/lib/server/system-log";
import {readTextBodyLimited,RequestBodyTooLarge} from "@/lib/server/read-limited-body";
import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {verifyRazorpayWebhook} from "@/lib/server/razorpay";
import {applyRazorpayInvoiceEntity,razorpayCurrencyUnit} from "@/lib/server/razorpay-invoices";

export const dynamic="force-dynamic";

function eventKey(raw:string,event:any){
 const id=String(event?.id||"").trim();
 return id?"id:"+id:"sha256:"+crypto.createHash("sha256").update(raw).digest("hex");
}

export async function POST(request:Request){
 let raw:string;
 try{raw=await readTextBodyLimited(request,1024*1024)}
 catch(error){return NextResponse.json({ok:false,error:error instanceof RequestBodyTooLarge?"Webhook payload too large":"Invalid webhook payload"},{status:error instanceof RequestBodyTooLarge?413:400,headers:{"Cache-Control":"no-store"}})}

 const sig=request.headers.get("x-razorpay-signature")||"";
 if(!verifyRazorpayWebhook(raw,sig))return NextResponse.json({ok:false,error:"Invalid Razorpay webhook signature."},{status:401});

 let event:any;
 try{event=JSON.parse(raw)}catch{return NextResponse.json({ok:false,error:"Invalid webhook JSON."},{status:400})}

 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return NextResponse.json({ok:false,error:"Server database configuration is missing."},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});

 const key=eventKey(raw,event),eventType=String(event?.event||"unknown");
 const entity=event?.payload?.invoice?.entity;
 const razorpayInvoiceId=entity?.id?String(entity.id):null;

 const {error:claimError}=await db.from("razorpay_webhook_events").insert({
  event_key:key,event_type:eventType,razorpay_event_id:event?.id?String(event.id):null,
  razorpay_invoice_id:razorpayInvoiceId,attempt_count:1
 });
 if(claimError&&String(claimError.code)!=="23505")return NextResponse.json({ok:false,error:claimError.message},{status:500});
 if(claimError&&String(claimError.code)==="23505"){
  const {data:existing,error:readError}=await db.from("razorpay_webhook_events").select("processed_at,processing_error,attempt_count").eq("event_key",key).maybeSingle();
  if(readError)return NextResponse.json({ok:false,error:readError.message},{status:500});
  if(existing?.processed_at&&!existing.processing_error)return NextResponse.json({ok:true,duplicate:true});
  const {error:retryError}=await db.from("razorpay_webhook_events").update({
   processed_at:null,processing_error:null,attempt_count:Number(existing?.attempt_count||0)+1
  }).eq("event_key",key);
  if(retryError)return NextResponse.json({ok:false,error:retryError.message},{status:500});
 }

 try{
  if(!entity?.id){
   const {error}=await db.from("razorpay_webhook_events").update({processed_at:new Date().toISOString(),processing_error:null}).eq("event_key",key);
   if(error)throw new Error(error.message);
   return NextResponse.json({ok:true,ignored:true});
  }

  const {data:invoice,error:invoiceError}=await db.from("student_invoices").select("*").eq("razorpay_invoice_id",entity.id).maybeSingle();
  if(invoiceError)throw new Error(invoiceError.message);
  if(!invoice){
   const {error}=await db.from("razorpay_webhook_events").update({processed_at:new Date().toISOString(),processing_error:null}).eq("event_key",key);
   if(error)throw new Error(error.message);
   return NextResponse.json({ok:true,ignored:true,reason:"invoice_not_found"});
  }

  const paymentId=entity.payment_id||event?.payload?.payment?.entity?.id||null;
  const rawPaymentAmount=Number(event?.payload?.payment?.entity?.amount);
  const paidTransactionAmount=Number.isFinite(rawPaymentAmount)&&rawPaymentAmount>0?rawPaymentAmount/razorpayCurrencyUnit(invoice.currency):undefined;
  await applyRazorpayInvoiceEntity(db,invoice,entity,"webhook",paymentId,paidTransactionAmount);

  const {error:doneError}=await db.from("razorpay_webhook_events").update({processed_at:new Date().toISOString(),processing_error:null}).eq("event_key",key);
  if(doneError)throw new Error(doneError.message);
  return NextResponse.json({ok:true});
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  await db.from("razorpay_webhook_events").update({processed_at:null,processing_error:message}).eq("event_key",key);
  const referenceId=await logSystemEvent({source:"razorpay-webhook",action:"invoice-reconciliation",code:"RAZORPAY_EVENT_PROCESSING_FAILURE",message:"Invoice webhook processing failed"});
  return NextResponse.json({ok:false,error:"Webhook processing failed",referenceId},{status:500});
 }
}
