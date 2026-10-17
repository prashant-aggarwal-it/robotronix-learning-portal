import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,apiFailure} from "@/lib/server/admin-api";
import {razorpayMode,razorpayRequest} from "@/lib/server/razorpay";
import {applyRazorpayInvoiceEntity,syncRazorpayInvoice} from "@/lib/server/razorpay-invoices";

const EXPORT_DECLARATION="SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX";
const SUPPLIER={
 name:"Robotronix Tech Lab",gstin:"07AEIPA4473M1ZB",
 address:"F-184/D, Aggarwals Paliwal Dharamshala Marg, Laxmi Nagar, East Delhi, Delhi 110092, India",
 email:"robotronixstemlab@gmail.com",phone:"+918595772008",sac:"999293",purpose:"P1107"
};
function plusDays(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function expiryUnix(date:string){return Math.floor(new Date(`${date}T23:59:00Z`).getTime()/1000)}
function smallestUnit(amount:number,currency:string){const three=new Set(["BHD","KWD","OMR"]);return Math.round(amount*(three.has(currency)?1000:100));}
function terms(sessions:number|undefined,service:string){return `${sessions?`This fee is for ${sessions} online session${sessions===1?"":"s"}`:"This fee is for the agreed online training package"} under the Robotronix™ ${service} program. Fees once paid are non-refundable and non-transferable. Session scheduling will be mutually decided and rescheduling is allowed with prior notice. Missed sessions without prior notice may be considered lapsed.`}
function internalRef(student:string,courseCode:string){const s=student.replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,10)||"STUDENT";const c=(courseCode||"COURSE").replace(/^RTX-/i,"").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,8);return `${s}-${c}`;}
async function packageContext(admin:any,packageId:string){
 const {data:pkg,error:pe}=await admin.from("student_fee_packages").select("*").eq("id",packageId).maybeSingle();if(pe||!pkg)throw new Error("Fee package not found.");
 const {data:enr,error:ee}=await admin.from("enrollments").select("id,student_id,course_id").eq("id",pkg.enrollment_id).maybeSingle();if(ee||!enr)throw new Error("Enrollment not found.");
 const [{data:student},{data:course},{data:guardian}]=await Promise.all([
   admin.from("students").select("id,full_name,city,state,country").eq("id",enr.student_id).maybeSingle(),
   admin.from("courses").select("id,title,short_title,public_name,code").eq("id",enr.course_id).maybeSingle(),
   admin.from("student_guardians").select("*").eq("student_id",enr.student_id).maybeSingle()
 ]);
 if(!student||!course)throw new Error("Student or course record is missing.");
 const {data:link}=await admin.from("parent_students").select("parent_id").eq("student_id",student.id).limit(1).maybeSingle();
 let billing:any=null,parentAddress:any=null;
 if(link?.parent_id){
   billing=(await admin.from("parent_billing_profiles").select("*").eq("parent_id",link.parent_id).maybeSingle()).data;
   parentAddress=(await admin.from("parent_addresses").select("*").eq("parent_id",link.parent_id).eq("is_primary",true).eq("is_active",true).maybeSingle()).data;
 }
 return{pkg,enr,student,course,guardian:guardian||{},parentId:link?.parent_id||null,billing,parentAddress};
}
function billingFromContext(ctx:any){
 const b=ctx.billing||{},a=ctx.parentAddress||{},g=ctx.guardian||{};
 const usePrimary=b.same_as_primary_address!==false;
 return{
  name:String(b.billing_name||g.billing_name||g.primary_guardian_name||g.mother_name||g.father_name||"").trim(),
  email:String(b.billing_email||g.billing_email||g.parent_login_email||"").trim(),
  phone:String(b.billing_phone||g.billing_phone||g.primary_whatsapp||g.primary_guardian_mobile||"").trim(),
  line1:String((usePrimary?a.address_line1:b.billing_address_line1)||g.billing_address_line1||g.address_line1||"").trim(),
  line2:String((usePrimary?a.address_line2:b.billing_address_line2)||g.billing_address_line2||g.address_line2||"").trim(),
  city:String((usePrimary?a.city:b.billing_city)||g.billing_city||ctx.student.city||"").trim(),
  state:String((usePrimary?a.state:b.billing_state)||g.billing_state||ctx.student.state||"").trim(),
  postal:String((usePrimary?a.postal_code:b.billing_postal_code)||g.billing_postal_code||g.postal_code||"").trim(),
  country:String((usePrimary?a.country:b.billing_country)||g.billing_country||ctx.student.country||"").trim()
 };
}
function uiInvoice(i:any){return{...i,package_id:i.fee_package_id,amount:Number(i.foreign_amount||0),amount_due:Number(i.amount_due??i.foreign_amount??0),amount_paid:Number(i.amount_paid||0),exchange_rate_to_inr:Number(i.fx_rate_to_inr||0),exchange_rate_source:i.fx_source||"",service_name:i.service_title||"",sessions:i.session_count,terms:i.terms_text||"",provider_response:i.razorpay_response||{},provider_request:i.razorpay_payload||{},last_notification_at:i.metadata?.last_notification_at||null,last_notification_medium:i.metadata?.last_notification_medium||null}}

export async function GET(request:NextRequest){
 const ctx=await requireAdmin(request);if(ctx.error)return ctx.error;const admin=ctx.admin!;
 try{
  const [{data:invoices,error:ie},{data:packages,error:pe}]=await Promise.all([
    admin.from("student_invoices").select("*").order("created_at",{ascending:false}),
    admin.from("student_fee_packages").select("*").order("created_at",{ascending:false})
  ]);if(ie||pe)throw new Error(ie?.message||pe?.message);
  const rows=[] as any[];
  const packageSummaries=[] as any[];
  for(const pkg of packages||[]){
    try{
      const c=await packageContext(admin,pkg.id),b=billingFromContext(c);
      const existing=(invoices||[]).find((i:any)=>i.fee_package_id===pkg.id);
      packageSummaries.push({packageId:pkg.id,enrollmentId:c.enr.id,packageName:pkg.name,currency:pkg.currency,amount:Number(pkg.amount),sessions:pkg.sessions,startDate:pkg.start_date,endDate:pkg.end_date,invoiceId:existing?.id||null,invoiceStatus:existing?.status||null,international:String(b.country||c.student.country).toLowerCase()!=="india"});
      if(existing||String(pkg.currency).toUpperCase()==="INR")continue;
      rows.push({packageId:pkg.id,enrollmentId:c.enr.id,packageName:pkg.name,currency:pkg.currency,amount:Number(pkg.amount),sessions:pkg.sessions,studentId:c.student.id,studentName:c.student.full_name,courseTitle:c.course.title,courseCode:c.course.code,customer:b,addressComplete:Boolean(b.name&&b.email&&b.phone&&b.line1&&b.city&&b.state&&b.postal&&b.country),international:String(b.country||c.student.country).toLowerCase()!=="india"});
    }catch{}
  }
  return NextResponse.json({ok:true,mode:razorpayMode(),invoices:(invoices||[]).map(uiInvoice),candidates:rows,packageSummaries,supplier:SUPPLIER},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return apiFailure(e instanceof Error?e.message:"Unable to load invoices.",500)}
}

export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if(auth.error)return auth.error;const admin=auth.admin!,actorId=auth.actorId!;
 let body:any;try{body=await request.json()}catch{return apiFailure("Invalid request.")}
 const action=String(body.action||"");
 try{
  if(action==="create"){
    const packageId=String(body.packageId||"");const rate=Number(body.exchangeRate);const rateSource=String(body.exchangeRateSource||"");const fxFetchedAt=String(body.fxFetchedAt||"");
    if(!packageId||!Number.isFinite(rate)||rate<=0||!rateSource||!fxFetchedAt)return apiFailure("A fresh automatic exchange rate is required.");
    if(!body.exportEligibilityConfirmed)return apiFailure("Confirm the export-service/LUT eligibility review before creating the invoice.");
    const {data:existingInvoice,error:existingError}=await admin.from("student_invoices").select("*").eq("fee_package_id",packageId).maybeSingle();
    if(existingError)throw new Error(existingError.message);
    if(existingInvoice)return NextResponse.json({ok:true,reused:true,invoice:uiInvoice(existingInvoice)});
    const c=await packageContext(admin,packageId),b=billingFromContext(c);
    if(String(c.pkg.currency).toUpperCase()==="INR")return apiFailure("Razorpay invoice creation is restricted to international fee packages.");
    if(String(b.country).trim().toLowerCase()==="india")return apiFailure("This workflow is for international customers only.");
    const missing=Object.entries({name:b.name,email:b.email,phone:b.phone,address:b.line1,city:b.city,state:b.state,postal:b.postal,country:b.country}).filter(([,v])=>!String(v||"").trim()).map(([k])=>k);
    if(missing.length)return apiFailure(`Complete the billing profile before invoicing: ${missing.join(", ")}.`);
    const issueDate=new Date().toISOString().slice(0,10),dueDate=plusDays(issueDate,2);
    const {data:numberData,error:numberError}=await admin.rpc("next_robotronix_invoice_number",{p_issue_date:issueDate});if(numberError||!numberData)throw new Error(numberError?.message||"Could not allocate invoice number.");
    const invoiceNumber=String(numberData),serviceName=c.course.public_name||c.course.short_title||c.course.title;
    const serviceDescription=`Robotronix™ ${serviceName} (Online) – ${c.pkg.sessions} Sessions`;
    const invoiceTerms=terms(c.pkg.sessions,serviceName),amount=Number(c.pkg.amount),inr=Math.round(amount*rate*100)/100;
    const place=`Outside India – ${[b.city,b.state,b.country].filter(Boolean).join(", ")}`;
    const notes={
      "Supplier GSTIN":SUPPLIER.gstin,"Customer Name":b.name,"SAC Code":SUPPLIER.sac,
      "Invoice Value (INR)":inr.toFixed(2),"Conversion Rate":`1 ${c.pkg.currency} = ${rate.toFixed(4)} INR`,
      "Tax Details":"IGST: 0% · CGST/SGST: Not Applicable","Reverse Charge":"No","Place of Supply":place,
      "Export Declaration":EXPORT_DECLARATION,"Purpose Code":SUPPLIER.purpose
    };
    const payload:any={type:"invoice",draft:1,description:serviceDescription,receipt:invoiceNumber,partial_payment:false,email_notify:false,sms_notify:false,currency:c.pkg.currency,expire_by:expiryUnix(dueDate),customer:{name:b.name,email:b.email,contact:b.phone,billing_address:{line1:b.line1,line2:b.line2||undefined,city:b.city,state:b.state,zipcode:b.postal,country:b.country}},line_items:[{name:serviceDescription,description:`Student: ${c.student.full_name}`,amount:smallestUnit(amount,c.pkg.currency),currency:c.pkg.currency,quantity:1,sac_code:SUPPLIER.sac}],notes,terms:invoiceTerms};
    const rzp=await razorpayRequest("/invoices",{method:"POST",body:payload});
    const unit=["BHD","KWD","OMR"].includes(c.pkg.currency)?1000:100;
    const row={fee_package_id:c.pkg.id,enrollment_id:c.enr.id,student_id:c.student.id,parent_id:c.parentId,invoice_number:invoiceNumber,internal_reference:internalRef(c.student.full_name,c.course.code),razorpay_invoice_id:rzp.id,razorpay_invoice_number:rzp.invoice_number||invoiceNumber,razorpay_short_url:rzp.short_url||null,razorpay_payment_id:null,status:rzp.status||"draft",currency:c.pkg.currency,foreign_amount:amount,amount_paid:Number(rzp.amount_paid||0)/unit,amount_due:Number(rzp.amount_due??smallestUnit(amount,c.pkg.currency))/unit,fx_rate_to_inr:rate,fx_source:rateSource,fx_fetched_at:fxFetchedAt,invoice_value_inr:inr,issue_date:issueDate,due_date:dueDate,service_title:serviceName,service_description:serviceDescription,session_count:c.pkg.sessions,customer_name:b.name,customer_email:b.email,customer_phone:b.phone,billing_address_line1:b.line1,billing_address_line2:b.line2,billing_city:b.city,billing_state:b.state,billing_postal_code:b.postal,billing_country:b.country,supplier_name:SUPPLIER.name,supplier_gstin:SUPPLIER.gstin,supplier_address:SUPPLIER.address,supplier_email:SUPPLIER.email,supplier_phone:SUPPLIER.phone,sac_code:SUPPLIER.sac,igst_rate:0,igst_amount:0,cgst_sgst_applicable:false,reverse_charge:false,export_under_lut:true,place_of_supply:place,country_of_destination:b.country,export_declaration:EXPORT_DECLARATION,purpose_code:SUPPLIER.purpose,export_eligibility_confirmed:true,terms_text:invoiceTerms,admin_reviewed_at:new Date().toISOString(),admin_reviewed_by:actorId,razorpay_payload:payload,razorpay_response:rzp,created_by:actorId,updated_at:new Date().toISOString()};
    const {data,error}=await admin.from("student_invoices").insert(row).select("*").single();
    if(error){
      let compensation="";try{await razorpayRequest("/invoices/"+encodeURIComponent(String(rzp.id))+"/cancel",{method:"POST"});compensation=" The orphan Razorpay draft was automatically cancelled."}catch(cancelError){compensation=" Automatic cancellation of the orphan Razorpay draft also failed; review Razorpay invoice "+rzp.id+" manually."}
      throw new Error("Razorpay draft "+rzp.id+" was created, but the portal ledger could not save it: "+error.message+compensation);
    }
    return NextResponse.json({ok:true,invoice:uiInvoice(data)});
  }
  const id=String(body.id||"");if(!id)return apiFailure("Invoice id is required.");
  const {data:invoice,error}=await admin.from("student_invoices").select("*").eq("id",id).maybeSingle();if(error||!invoice)return apiFailure("Invoice not found.",404);
  if(!invoice.razorpay_invoice_id)return apiFailure("Razorpay invoice id is missing.");
  if(action==="issue"){
    if(invoice.status!=="draft")return apiFailure("Only a draft invoice can be issued.");
    const rzp=await razorpayRequest(`/invoices/${invoice.razorpay_invoice_id}/issue`,{method:"POST"});
    const data=await applyRazorpayInvoiceEntity(admin,invoice,rzp,"action");return NextResponse.json({ok:true,invoice:uiInvoice(data)});
  }
  if(action==="notify"){
    if(!["issued","partially_paid"].includes(invoice.status))return apiFailure("Issue the invoice before sending it.");
    const medium=body.medium==="sms"?"sms":"email";const r=await razorpayRequest(`/invoices/${invoice.razorpay_invoice_id}/notify_by/${medium}`,{method:"POST"});
    const metadata={...(invoice.metadata||{}),last_notification_at:new Date().toISOString(),last_notification_medium:medium};
    const {error:notifySaveError}=await admin.from("student_invoices").update({metadata,updated_at:new Date().toISOString()}).eq("id",invoice.id);
    if(notifySaveError)throw new Error("Invoice notification was sent, but the notification audit could not be saved: "+notifySaveError.message);
    return NextResponse.json({ok:true,...r});
  }
  if(action==="cancel"){
    if(["paid","cancelled","expired"].includes(invoice.status))return apiFailure("This invoice cannot be cancelled in its current state.");
    const rzp=await razorpayRequest(`/invoices/${invoice.razorpay_invoice_id}/cancel`,{method:"POST"});const data=await applyRazorpayInvoiceEntity(admin,invoice,rzp,"action");return NextResponse.json({ok:true,invoice:uiInvoice(data)});
  }
  if(action==="sync"){
    const data=await syncRazorpayInvoice(admin,invoice);
    return NextResponse.json({ok:true,invoice:uiInvoice(data)});
  }
  return apiFailure("Unsupported invoice action.");
 }catch(e){return apiFailure(e instanceof Error?e.message:"Invoice operation failed.",500)}
}
