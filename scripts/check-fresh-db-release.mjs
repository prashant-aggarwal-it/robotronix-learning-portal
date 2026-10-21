import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const schema=fs.readFileSync(path.join(root,'database/01_install/01_CREATE_SCHEMA.sql'),'utf8');

// Reject malformed single-dollar PL/pgSQL delimiters before execution.
if (/\bdo\s+\$(?!\$)/i.test(schema) || /\bend\s+\$;/i.test(schema)) {
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
  'grant usage on schema public to authenticated',
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
if(fs.existsSync(path.join(root,'database/04_hotfixes')))throw new Error('Fresh release must not contain database/04_hotfixes.');
for(const file of ['database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql','database/03_verify/01_VERIFY_RELEASE.sql','database/02_qa/01_QA_SEED.sql','database/02_qa/02_QA_CLEANUP.sql']){
  if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing required release database file: ${file}`);
}
// Guard against stale SQL paths in future check scripts after consolidation.
const scriptsDir=path.join(root,'scripts');
const stale=[];
// Only static check scripts must refer to tracked, present SQL files.\n// Operational QA generators intentionally reference SQL they create later.\nfor(const name of fs.readdirSync(scriptsDir).filter(n=>n.startsWith('check-')&&n.endsWith('.mjs'))){
 const source=fs.readFileSync(path.join(scriptsDir,name),'utf8');
 // Identify literals referring to concrete SQL files, excluding dynamic examples.
 for(const match of source.matchAll(/database\/[-A-Za-z0-9_./]+\.sql/g)){
  const referenced=match[0];
  if(!fs.existsSync(path.join(root,referenced)))stale.push(name+': '+referenced);
 }
}
if(stale.length)throw new Error('Release scripts refer to missing SQL files:\n'+stale.join('\n'));

console.log('Fresh database release check passed: schema is consolidated and no hotfix folder remains.');
