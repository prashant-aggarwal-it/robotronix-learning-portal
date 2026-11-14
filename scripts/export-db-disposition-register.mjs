#!/usr/bin/env node
// Generates a complete conservative disposition register; never authorizes destructive DDL.
import fs from 'node:fs';
import path from 'node:path';
const source=JSON.parse(fs.readFileSync('database/audit/dev_catalog_snapshot.json','utf8'));
const folder=path.resolve(process.argv[2]||'artifacts/db-object-dispositions');
fs.mkdirSync(folder,{recursive:true});
const academy=/^(students|parents|parent_|student_guardians|courses|course_|trainer|cohorts|enrollments|enrollment_|schedule_events|class_attendance|session_records|demo_|onboarding_|learning_|learner_|project_|quiz|xp_)/;
const finance=/^(student_invoice|student_fee|student_family_receipts|trainer_earning|trainer_payout|trainer_finance|trainer_compensation|invoice_sequences|razorpay_)/;
const communication=/^(communication_|portal_notifications|reminder_|whatsapp_|email_|message_|conversations|outbox|channel_)/;
function domain(s,n){
 if(s==='connect')return communication.test(n)?'communications':'crm';
 if(s==='tasks')return 'tasks';
 if(finance.test(n))return 'finance';
 if(communication.test(n))return 'communications';
 if(n.startsWith('zoom_'))return 'integrations';
 if(academy.test(n))return 'academy';
 return 'platform-or-system';
}
const tables=[...new Map(source.tables.map(r=>[r.schema+'.'+r.name,r])).values()];
const rows=[];
for(const t of tables)rows.push({type:'table',object:t.schema+'.'+t.name,domain:domain(t.schema,t.name),disposition:'retain-unchanged',target:t.schema+'.'+t.name,assurance:'baseline; must test future migration'});
for(const f of source.functions)rows.push({type:'function',object:f.schema+'.'+f.name+'('+f.args+')',domain:domain(f.schema,f.name),disposition:'retain-signature-and-behavior',target:f.schema+'.'+f.name,assurance:'arguments/returns/grants/SQLSTATE and behavior need test'});
for(const p of source.policies)rows.push({type:'policy',object:p.schema+'.'+p.name+':'+p.policy,domain:domain(p.schema,p.name),disposition:'retain-rls-behavior',target:p.schema+'.'+p.name,assurance:'tenant isolation/role tests required'});
for(const t of source.triggers)rows.push({type:'trigger',object:t.schema+'.'+t.name+':'+t.trigger_name,domain:domain(t.schema,t.name),disposition:'retain-trigger-contract',target:t.schema+'.'+t.name,assurance:'side effects and idempotency tests required'});
const keys=['type','object','domain','disposition','target','assurance'];
fs.writeFileSync(path.join(folder,'object_dispositions.csv'),[keys.join(','),...rows.map(x=>keys.map(k=>'"'+String(x[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n');
fs.writeFileSync(path.join(folder,'README.md'),`# Conservative disposition register
Generated from **DEV read-only snapshot**. Entries are exhaustive over captured tables, non-extension functions, RLS policies and triggers; they do NOT constitute verified target migrations.
Default **retain** means no existing application contract is intentionally modified. No deletions, renames or consolidations are authorized.
Functions/policies/triggers must receive detailed caller and behavioral validation before a different target disposition is approved.
Rows: ${rows.length} (tables ${tables.length}, functions ${source.functions.length}, policies ${source.policies.length}, triggers ${source.triggers.length}).
`);
console.log('Recorded',rows.length,'conservative object dispositions');
