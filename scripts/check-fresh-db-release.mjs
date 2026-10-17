import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const schema=fs.readFileSync(path.join(root,'database/01_install/01_CREATE_SCHEMA.sql'),'utf8');
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
for(const file of ['database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql','database/03_verify/01_VERIFY_RELEASE.sql','database/02_sanity/01_PROD_SANITY_SEED.sql','database/02_sanity/02_PROD_SANITY_CLEANUP.sql']){
  if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing required release database file: ${file}`);
}
console.log('Fresh database release check passed: schema is consolidated and no hotfix folder remains.');
