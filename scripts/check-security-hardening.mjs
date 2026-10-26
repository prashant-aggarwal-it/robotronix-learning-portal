import fs from 'node:fs';
import path from 'node:path';
import {readCanonicalSql} from './read-canonical-sql.mjs';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const problems=[];
const must=(test,description)=>{if(!test)problems.push(description)};
const schema=readCanonicalSql();
const config=read('next.config.ts');
const adminApi=read('lib/server/admin-api.ts');
const readFiles=(directory,results=[])=>{
 for(const item of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){
  if(['node_modules','.next','.git','archive','dist','playwright-report','test-results'].includes(item.name))continue;
  const p=path.join(directory,item.name);
  if(item.isDirectory())readFiles(p,results);
  else if(/\.(?:tsx?|mjs|cjs|json|yml|yaml|md|sql)$/.test(item.name) && item.name!=='package-lock.json')results.push(p);
 }return results;
};
for(const folder of ['app','lib','components','database/01_install','scripts','.github/workflows']){
 if(!fs.existsSync(path.join(root,folder)))continue;
 for(const file of readFiles(folder)){
  const text=read(file);
  // Only high-confidence credential signatures; public anon/publishable keys are not secret.
  const rules=[
   /(?:sk_live|rk_live)_[A-Za-z0-9]{20,}/,
   /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
   /(?:SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|ZOOM_CLIENT_SECRET)\s*[:=]\s*['"][A-Za-z0-9_\-]{32,}['"]/,
   /(?:password|client_secret)\s*[:=]\s*['"](?:eyJ[A-Za-z0-9._-]{60,}|[A-Za-z0-9_-]{70,})['"]/i
  ];
  if(rules.some(pattern=>pattern.test(text)))problems.push('Potential committed credential: '+file);
 }
}
for(const marker of ['Content-Security-Policy','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy'])
 must(config.includes(marker),'Security response header missing: '+marker);
must(adminApi.includes('auth.getUser(token)') && adminApi.includes('role!=="admin"') && adminApi.includes('!profile.active'),'Server Admin authentication guard absent');
for(const fn of ['generate_enrollment_schedule_v2','generate_cohort_schedule_v2','reassign_enrollment_trainer_v2','reassign_cohort_trainer_v2','resolve_class_cancellation_v2']){
 must(schema.includes('public.'+fn),'Scheduling RPC not present: '+fn);
 must(new RegExp('revoke all on function public\\.'+fn+'\\(').test(schema),'RPC lacks explicit public/anon EXECUTE revoke: '+fn);
}
for(const signature of ['next_robotronix_invoice_number\\(date\\)','refresh_enrollment_progress\\(uuid\\)']){
 must(new RegExp('revoke execute on function public\\.'+signature+'\\s+from public, anon, authenticated','i').test(schema),'Privileged maintenance RPC lacks public/anon/authenticated revoke: '+signature);
}
for(const table of ['profiles','parents','students','enrollments','schedule_events','class_attendance','trainer_earnings','student_fee_payments','portal_notifications']){
 must(new RegExp('alter table (?:if exists )?public\\.'+table+' enable row level security','i').test(schema),'RLS enable marker absent: '+table);
}
if(problems.length){
 console.error('SECURITY HARDENING CHECK FAILED:\n'+problems.map(x=>' - '+x).join('\n'));
 process.exitCode=1;
}else console.log('Security hardening source checks passed (not a penetration test).');
