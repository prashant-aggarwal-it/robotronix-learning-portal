import fs from "node:fs";

const files=[
 "lib/export-workbook.ts",
 "app/admin/invoices/page.tsx",
 "app/admin/trainer-finance/page.tsx",
 "app/admin/trainer-finance/[trainerId]/page.tsx",
 "app/admin/audit/page.tsx",
 "app/admin/classes/page.tsx",
 "app/admin/students/page.tsx"
];
for(const file of files)if(!fs.existsSync(file))throw new Error("Missing export file: "+file);

const util=fs.readFileSync("lib/export-workbook.ts","utf8");
for(const marker of ["buildWorkbookBytes","cleanText","storedZip","inlineStr","createObjectURL","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])
 if(!util.includes(marker))throw new Error("Secure XLSX export utility missing: "+marker);
if(util.includes('import("xlsx")')||util.includes("XLSX.writeFile"))
 throw new Error("Vulnerable SheetJS runtime must not be reintroduced.");

for(const [file,markers] of Object.entries({
 "app/admin/invoices/page.tsx":["Export Excel","Robotronix-Razorpay-Invoices"],
 "app/admin/trainer-finance/page.tsx":["Export Excel","Robotronix-Trainer-Payroll"],
 "app/admin/trainer-finance/[trainerId]/page.tsx":["Export Excel","Class Earnings"],
 "app/admin/audit/page.tsx":["Export Excel","Correction Requests","Audit History"],
 "app/admin/classes/page.tsx":["Export Excel","Classes","Attendance"],
 "app/admin/students/page.tsx":["Export Excel"]
})){
 const text=fs.readFileSync(file,"utf8");
 for(const marker of markers)if(!text.includes(marker))throw new Error(file+" missing export marker: "+marker);
}
console.log("Operational exports structure: OK");
