import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const modulesDir=path.join(root,'database/01_install/modules');
const sqlModules=(kind)=>fs.readdirSync(path.join(modulesDir,kind)).filter(name=>/^\d\d_[a-z0-9_]+\.sql$/.test(name)).sort().map(name=>fs.readFileSync(path.join(modulesDir,kind,name),'utf8')).join('');
const schema=sqlModules('schema');
const reference=sqlModules('reference');
if(!schema||!reference)throw new Error('Missing canonical SQL modules.');

// Reject malformed single-dollar PL/pgSQL delimiters before execution.
if (/\bdo\s+\$(?!\$)/i.test(schema) || /\bas\s+\$(?!\$)/i.test(schema) || /\bend\s+\$;/i.test(schema)) {
  throw new Error('Fresh schema has an invalid PL/pgSQL dollar delimiter (expected double dollars).');
}

const must=[
  'schedule_override_confirmed',
  'notify_admin_on_onboarding_submission',
  'learning_observation_internal_notes',
  'opening_completed_sessions',
  'migration_type',
  'zoom_host_accounts',
  'zoom_meetings',
  'demo_leads',
  'demo_sessions',
  'demo_session_participants',
  'demo_guest_requests',
  'zoom_host_active_meeting_no_overlap',
  'zoom_join_intents',
  'zoom_recordings',
  'zoom_participant_sessions',
  'calendar_subscription_tokens',
  'razorpay_webhook_events',
  'activated_student_id',
  'activated_enrollment_id',
  'replace_trainer_availability_v1',
  'onboarding_submission_admin_notification_trg',
  'grant usage on schema public to authenticated',
  'audit_core_change()',
  "'portal_access_requests','student_invoices','zoom_meetings','zoom_recordings'",
  'portal_job_runs',
];
for(const marker of must){if(!schema.includes(marker))throw new Error(`Fresh schema missing consolidated marker: ${marker}`)}

const cohortBlock=schema.match(/create table if not exists public\.cohorts \([\s\S]*?\n\);/)?.[0] ?? '';
const enrollmentBlock=schema.match(/create table if not exists public\.enrollments \([\s\S]*?\n\);/)?.[0] ?? '';
for (const col of ['schedule_override_confirmed','schedule_override_note']) {
  if (!enrollmentBlock.includes(col)) throw new Error(`Fresh schema: public.enrollments is missing ${col}.`);
  if (cohortBlock.includes(col)) throw new Error(`Fresh schema: ${col} was incorrectly placed on public.cohorts.`);
}

const enrollmentStartGuard=schema.match(/create or replace function public\.enforce_new_enrollment_start_date\(\)[\s\S]*?end \${2};/)?.[0] ?? '';
if(!enrollmentStartGuard.includes("coalesce(new.migration_type, 'native') <> 'active_existing'")){
  throw new Error('Fresh schema enrollment start-date guard does not permit historical dates for active_existing migrations.');
}
if(fs.existsSync(path.join(root,'database/archive')))throw new Error('Archived SQL must not ship in canonical release.');
const qaSql=fs.readdirSync(path.join(root,'database/02_qa')).filter(name=>name.endsWith('.sql')).sort();
const expectedQaSql=['01_PREPARE_DEV_QA_PROFILES.sql','02_RUN_DEV_QA_DATA.sql','03_VERIFY_DEV_QA.sql'];
if(JSON.stringify(qaSql)!==JSON.stringify(expectedQaSql))throw new Error('Unexpected DEV QA SQL files: '+qaSql.join(', '));
if(fs.existsSync(path.join(root,'database/04_hotfixes'))throw new Error('Fresh release must not contain database/04_hotfixes.');
for(const file of ['database/03_verify/01_VERIFY_RELEASE.sql','database/02_qa/01_PREPARE_DEV_QA_PROFILES.sql','database/02_qa/02_RUN_DEV_QA_DATA.sql','database/02_qa/03_VERIFY_DEV_QA.sql']){
  if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing required release database file: ${file}`);
}
// Consolidated releases must never require separate post-install SQL patches.
const verificationFiles=fs.readdirSync(path.join(root,'database/03_verify'));
const unexpectedVerificationSql=verificationFiles.filter(name=>name.endsWith('.sql') && name!=='01_VERIFY_RELEASE.sql');
if(unexpectedVerificationSql.length)throw new Error('Extra SQL scripts found in 03_verify: '+unexpectedVerificationSql.join(', '));
for(const directory of ['database/04_hotfixes','database/04_migrations','database/05_features','database/migrations','supabase/migrations']){
 if(fs.existsSync(path.join(root,directory)))throw new Error('Incremental SQL patch directory must not ship in the release: '+directory);
}
for(const name of fs.readdirSync(path.join(root,'database/01_install'))){
 if(name.endsWith('.sql')&&!['03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql'].includes(name))
  throw new Error('Unexpected extra install script: '+name);
}
// Guard against stale SQL paths in future check scripts after consolidation.
const scriptsDir=path.join(root,'scripts');
const stale=[];
// Only static check scripts must refer to tracked, present SQL files.
// Operational QA generators intentionally reference SQL they create later.
for(const name of fs.readdirSync(scriptsDir).filter(n=>n.startsWith('check-')&&n.endsWith('.mjs'))){
 const source=fs.readFileSync(path.join(scriptsDir,name),'utf8');
 // Identify literals referring to concrete SQL files, excluding dynamic examples.
 for(const match of source.matchAll(/database\/[-A-Za-z0-9_./]+\.sql/g)){
  const referenced=match[0];
  if(!fs.existsSync(path.join(root,referenced)))stale.push(name+': '+referenced);
 }
}
if(stale.length)throw new Error('Release scripts refer to missing SQL files:\n'+stale.join('\n'));


// Confirm the post-activation IDs and atomic availability function are in the
// canonical fresh schema, so fresh installs never need the additive migration.
const onboarding=schema.match(/create table if not exists public\.onboarding_submissions \([\s\S]*?\n\);/)?.[0]??'';
for(const column of ['activated_student_id','activated_enrollment_id']){
 if(!onboarding.includes(column))throw new Error('Fresh onboarding schema missing activation link: '+column);
}
for(const marker of [
 'create or replace function public.replace_trainer_availability_v1(',
 'pg_advisory_xact_lock',
 'revoke all on function public.replace_trainer_availability_v1',
 'grant execute on function public.replace_trainer_availability_v1',
 'zoom_host_active_meeting_no_overlap',
 'onboarding_submission_admin_notification_trg'
]){
 if(!schema.includes(marker))throw new Error('Fresh schema missing protected workflow: '+marker);
}
const verify=fs.readFileSync(path.join(root,'database/03_verify/01_VERIFY_RELEASE.sql'),'utf8');
for(const marker of ['replace_trainer_availability_v1','activated_student_id','activated_enrollment_id','zoom_host_active_meeting_no_overlap']){
 if(!verify.includes(marker))throw new Error('Release database verification missing: '+marker);
}

console.log('Fresh database release check passed: ordered functional SQL modules are present and validated.');
