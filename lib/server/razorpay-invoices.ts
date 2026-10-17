import type {SupabaseClient} from "@supabase/supabase-js";
import {razorpayRequest} from "@/lib/server/razorpay";

export function razorpayCurrencyUnit(currency:string){
 return ["BHD","KWD","OMR"].includes(String(currency||"").toUpperCase())?1000:100;
}

export async function recordPaidFeePayment(db:SupabaseClient,invoice:any,paymentId:string,amount:number){
 if(!paymentId||!invoice?.fee_package_id)return;
 const {error}=await db.from("student_fee_payments").upsert({
  id:cryptoRandomId(),
  package_id:invoice.fee_package_id,
  amount:Number(amount||invoice.foreign_amount||0),
  payment_date:new Date().toISOString().slice(0,10),
  method:"Razorpay",
  reference:paymentId,
  kind:"payment"
 },{onConflict:"package_id,reference",ignoreDuplicates:true});
 if(error)throw new Error("Invoice was paid, but the fee-payment ledger could not be updated: "+error.message);
}

function cryptoRandomId(){
 return globalThis.crypto.randomUUID();
}

export async function applyRazorpayInvoiceEntity(db:SupabaseClient,invoice:any,entity:any,source:"webhook"|"manual"|"action",paymentIdOverride?:string|null){
 const unit=razorpayCurrencyUnit(invoice.currency);
 const status=String(entity?.status||invoice.status);
 const amountPaid=Number(entity?.amount_paid??0)/unit;
 const amountDue=Number(entity?.amount_due??0)/unit;
 const paymentId=String(paymentIdOverride||entity?.payment_id||invoice.razorpay_payment_id||"")||null;
 const now=new Date().toISOString();
 const patch:any={
  status,
  amount_paid:Number.isFinite(amountPaid)?amountPaid:Number(invoice.amount_paid||0),
  amount_due:Number.isFinite(amountDue)?amountDue:Number(invoice.amount_due||0),
  razorpay_short_url:entity?.short_url||invoice.razorpay_short_url,
  razorpay_payment_id:paymentId,
  razorpay_response:entity||invoice.razorpay_response,
  last_synced_at:now,
  sync_error:null,
  updated_at:now
 };
 if(status==="paid"&&!invoice.paid_at)patch.paid_at=now;
 if(status==="cancelled"&&!invoice.cancelled_at)patch.cancelled_at=now;
 const {data,error}=await db.from("student_invoices").update(patch).eq("id",invoice.id).select("*").single();
 if(error)throw new Error("Unable to update the Robotronix invoice ledger: "+error.message);
 if(status==="paid"&&paymentId)await recordPaidFeePayment(db,{...invoice,...data},paymentId,patch.amount_paid||Number(invoice.foreign_amount||0));
 return data;
}

export async function syncRazorpayInvoice(db:SupabaseClient,invoice:any){
 try{
  const entity=await razorpayRequest("/invoices/"+encodeURIComponent(invoice.razorpay_invoice_id));
  return await applyRazorpayInvoiceEntity(db,invoice,entity,"manual");
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  await db.from("student_invoices").update({sync_error:message,last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",invoice.id);
  throw error;
 }
}
