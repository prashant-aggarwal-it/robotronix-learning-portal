import fs from "node:fs";

const required=[
 "app/api/admin/invoices/route.ts",
 "app/api/razorpay/webhook/route.ts",
 "lib/server/razorpay.ts",
 "lib/server/razorpay-invoices.ts",
 "app/admin/invoices/page.tsx",
 "components/finance/EnrollmentInvoicePanel.tsx",
 "database/04_upgrade/02_RAZORPAY_OPERATIONS_V1.sql"
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Razorpay operations file: "+file);

const api=fs.readFileSync("app/api/admin/invoices/route.ts","utf8");
for(const marker of ['action==="sync"',"syncRazorpayInvoice","fee_package_id","Automatic cancellation of the orphan Razorpay draft"]){
 if(!api.includes(marker))throw new Error("Razorpay invoice API is missing: "+marker);
}
const webhook=fs.readFileSync("app/api/razorpay/webhook/route.ts","utf8");
for(const marker of ["razorpay_webhook_events","attempt_count","processing_error","applyRazorpayInvoiceEntity"]){
 if(!webhook.includes(marker))throw new Error("Razorpay webhook hardening is missing: "+marker);
}
const ui=fs.readFileSync("app/admin/invoices/page.tsx","utf8");
for(const marker of ["Razorpay Billing","Needs attention","Copy Link","Sync","Overdue"]){
 if(!ui.includes(marker))throw new Error("Razorpay billing UI is missing: "+marker);
}
const schema=fs.readFileSync("database/01_install/01_CREATE_SCHEMA.sql","utf8");
for(const marker of ["razorpay_webhook_events","last_synced_at","sync_error","student_invoices_fee_package_unique"]){
 if(!schema.includes(marker))throw new Error("Fresh schema is missing Razorpay hardening: "+marker);
}
console.log("Razorpay operations structure: OK");
