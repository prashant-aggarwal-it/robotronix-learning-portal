import crypto from "crypto";
import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {verifyRazorpayWebhook} from "@/lib/server/razorpay";

export async function POST(request:Request){
 const raw=await request.text();const sig=request.headers.get("x-razorpay-signature")||"";
 if(!verifyRazorpayWebhook(raw,sig))return NextResponse.json({ok:false},{status:401});
 let event:any;try{event=JSON.parse(raw)}catch{return NextResponse.json({ok:false},{status:400})}
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return NextResponse.json({ok:false},{status:503});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const entity=event?.payload?.invoice?.entity;if(!entity?.id)return NextResponse.json({ok:true,ignored:true});
 const {data:invoice}=await db.from("student_invoices").select("*").eq("razorpay_invoice_id",entity.id).maybeSingle();if(!invoice)return NextResponse.json({ok:true,ignored:true});
 const unit=["BHD","KWD","OMR"].includes(invoice.currency)?1000:100;
 const status=String(entity.status||invoice.status);const paid=Number(entity.amount_paid||0)/unit,due=Number(entity.amount_due||0)/unit,paymentId=entity.payment_id||event?.payload?.payment?.entity?.id||null;
 const patch:any={status,amount_paid:paid,amount_due:due,razorpay_short_url:entity.short_url||invoice.razorpay_short_url,razorpay_payment_id:paymentId||invoice.razorpay_payment_id,razorpay_response:entity,updated_at:new Date().toISOString()};
 if(status==="paid")patch.paid_at=new Date().toISOString();if(status==="cancelled")patch.cancelled_at=new Date().toISOString();
 await db.from("student_invoices").update(patch).eq("id",invoice.id);
 if(status==="paid"&&paymentId){
  await db.from("student_fee_payments").upsert({id:crypto.randomUUID(),package_id:invoice.fee_package_id,amount:paid||invoice.foreign_amount,payment_date:new Date().toISOString().slice(0,10),method:"Razorpay",reference:paymentId,kind:"payment"},{onConflict:"package_id,reference",ignoreDuplicates:true});
 }
 return NextResponse.json({ok:true});
}
