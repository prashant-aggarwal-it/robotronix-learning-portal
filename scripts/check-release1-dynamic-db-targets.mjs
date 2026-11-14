#!/usr/bin/env node
// Deterministic review of allowed dynamic RPC targets. No network or database writes.
import fs from 'node:fs';
import path from 'node:path';
const snapshot=JSON.parse(fs.readFileSync('database/audit/dev_catalog_snapshot.json','utf8'));
const known=new Set(snapshot.functions.map(x=>x.name));
const out=path.resolve(process.argv[2]||'artifacts/release1-dynamic-contracts');
fs.mkdirSync(out,{recursive:true});
const rows=[];
const exceptions=[];
const read=p=>fs.readFileSync(p,'utf8');
function inspect(file,pattern,targetType,targets,review){
 const src=read(file),present=src.includes(pattern);
 if(!present)exceptions.push('Dynamic call moved or removed: '+file+' :: '+pattern);
 for(const name of targets){
  const found=targetType==='table'?snapshot.tables.some(x=>x.name===name):known.has(name);
  if(!found)exceptions.push('Dynamic target absent from DEV snapshot: '+name);
  rows.push({file,call:pattern,target:name,exists:found,review});
 }
}
inspect('app/api/admin/operational-alerts/route.ts','ctx.db!.from(table)','table',['enrollments','schedule_events','trainers'],'Finite mapping selected by hold/class/login; user-supplied IDs filtered after admin auth');
inspect('app/api/cron/system-log-retention/route.ts','db.rpc(fn,','function',['purge_old_portal_system_logs','purge_old_portal_job_runs'],'Cron shared-secret verification and maintenance permissions');
inspect('app/api/tasks/collaboration/route.ts','session.db.rpc(fn,args)','function',[
 'task_workspaces_list','task_invitations_list','task_workspace_members','task_comments_list','task_activity_list','task_attachments_list','task_collaborators_list','task_access_check',
 'task_workspace_create','task_invite_send','task_invite_accept','task_workspace_member_manage','task_workspace_task_create','task_share','task_collaborator_manage','task_comment_add'
 ],'Validated scope/action mapping; enforce task/workspace authorization inside RPC');
inspect('lib/server/connect-ingestion.ts','db.rpc(fn,args)','function',[
 'connect_ingest_channel','connect_ingest_website','connect_ingest_whatsapp_message','connect_ingest_whatsapp_status','connect_sync_whatsapp_app_contact',
 'connect_import_whatsapp_history_thread','connect_revise_whatsapp_message','connect_queue_whatsapp_history','connect_ingest_social_message','connect_enrich_inbound_email','connect_ingest_email_thread'
 ],'TypeScript union constrains function names; inbound webhook verification required');
inspect('netlify/functions/connect-portal-ops.mjs','db.rpc(name,','function',[
 'connect_process_portal_demo_followups','connect_reconcile_portal_enrollments','connect_sync_portal_lifecycle'
 ],'Worker operations allowlist; install-time capability and one active scheduler owner');
const remaining=['lib/server/connect-auth.ts'];
for(const file of remaining){
 if(!read(file).includes('session.admin.rpc(fn,args)'))exceptions.push('Connect invokeConnect wrapper changed');
}
const keys=['file','call','target','exists','review'];
const csv=[keys.join(','),...rows.map(x=>keys.map(k=>'"'+String(x[k]).replaceAll('"','""')+'"').join(','))].join('\n')+'\n';
fs.writeFileSync(path.join(out,'resolved_dynamic_targets.csv'),csv);
const result={resolvedTargets:rows.length,missingTargets:rows.filter(x=>!x.exists).length,sourceMismatches:exceptions.length,remainingManualReview:[{file:'lib/server/connect-auth.ts',reason:'Generic invokeConnect accepts fn:string; verify every upstream caller and tenant scope before certification'},{file:'scripts/check-cross-module-refactor-contracts.mjs',reason:'String assertion, not runtime database call'}],limits:['Name existence only; argument and RLS behavior not yet certified','Do not certify the broad invokeConnect wrapper without call graph evidence']};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({...result,exceptions},null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(exceptions.length)process.exitCode=1;
