import { createClient } from '@supabase/supabase-js';
import { test, expect } from '@playwright/test';
import { ensureRoleSession } from './session';
import { loadQaEnv, qaCredentials, serviceConfig } from './env';
import { QA_IDS, qaDb } from './qa-db';

test.setTimeout(75_000);

const ENROLLMENT_ID='e1000000-0000-4000-8000-000000000001';
const PACKAGE_ID='e1000000-0000-4000-8000-000000000002';
const PAYMENT_ID='e1000000-0000-4000-8000-000000000003';
const PACKAGE_NAME='SANITY-AUTO Migrated Active Package';
const INTERNAL_NOTE='SANITY-AUTO private trainer note';

function iso(days=0){const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}

async function cleanup(){
 const db=qaDb();
 await db.from('student_fee_payments').delete().eq('id',PAYMENT_ID);
 await db.from('student_fee_packages').delete().eq('id',PACKAGE_ID);
 await db.from('learning_observation_internal_notes').delete().eq('schedule_event_id',QA_IDS.workflowClass).eq('student_id',QA_IDS.student);
 await db.from('enrollments').delete().eq('id',ENROLLMENT_ID);
}

async function roleClient(role:'trainer'|'parent'){
 loadQaEnv();
 const {url,anonKey}=serviceConfig();
 if(!url||!anonKey)throw new Error('Supabase URL and anon key are required for migration privacy QA.');
 const c=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {email,password}=qaCredentials(role);
 const {error}=await c.auth.signInWithPassword({email,password});
 if(error)throw error;
 return c;
}

test.describe('Existing active student migration',()=>{
 test.beforeEach(async({page})=>{await cleanup();await ensureRoleSession(page,'admin')});
 test.afterEach(async()=>{await cleanup()});

 test('opening progress and negotiated finance are carried forward without fake classes',async({page})=>{
  const db=qaDb();
  const {error:enrollmentError}=await db.from('enrollments').insert({
   id:ENROLLMENT_ID,student_id:QA_IDS.student,course_id:QA_IDS.course,trainer_id:QA_IDS.trainer,
   enrollment_type:'one_to_one',status:'active',started_at:iso(-90),schedule_timezone:'Asia/Kolkata',schedule_rules:[],
   migration_type:'active_existing',opening_completed_sessions:5,opening_completed_minutes:300,
   migration_note:'SANITY negotiated active learner migration',portal_tracking_started_at:iso(0),
   program_model:'fixed_program',planned_sessions:24,auto_complete_on_session_limit:true,
  });
  if(enrollmentError)throw enrollmentError;

  await expect.poll(async()=>{
   const {data,error}=await db.from('enrollments').select('sessions_completed,progress_percent').eq('id',ENROLLMENT_ID).single();
   if(error)throw error;return Number(data.sessions_completed);
  },{timeout:15_000}).toBe(5);

  const {error:packageError}=await db.from('student_fee_packages').insert({
   id:PACKAGE_ID,enrollment_id:ENROLLMENT_ID,name:PACKAGE_NAME,scheme:'Custom',currency:'INR',amount:18000,sessions:24,
   start_date:iso(-90),end_date:iso(90),installments:[{due:iso(-90),amount:18000}],source:'migration',notes:'₹18,000 negotiated opening package',
  });
  if(packageError)throw packageError;
  const {error:paymentError}=await db.from('student_fee_payments').insert({
   id:PAYMENT_ID,package_id:PACKAGE_ID,amount:12000,payment_date:iso(0),method:'Opening balance',reference:'MIGRATED-SANITY',kind:'payment',source:'migration',
  });
  if(paymentError)throw paymentError;

  await page.goto(`/admin/enrollments/${ENROLLMENT_ID}`,{waitUntil:'domcontentloaded'});
  await expect(page.getByText(/5 classes before portal/i)).toBeVisible({timeout:15_000});
  await expect(page.getByText('SANITY negotiated active learner migration')).toBeVisible({timeout:15_000});

  await page.goto('/admin/finance',{waitUntil:'domcontentloaded'});
  const search=page.getByLabel('Search student packages');
  await expect(search).toBeVisible({timeout:15_000});
  await search.fill(PACKAGE_NAME);
  const row=page.locator('tbody tr').filter({hasText:PACKAGE_NAME});
  await expect(row).toBeVisible({timeout:15_000});
  await expect(row).toContainText('Migrated opening');
  await expect(row).toContainText('12,000');
  await expect(row).toContainText('6,000');
  await expect(row).toContainText('5 / 24');
 });

 test('private trainer note is visible to trainer but not parent',async()=>{
  const db=qaDb();
  const {error}=await db.from('learning_observation_internal_notes').upsert({
   schedule_event_id:QA_IDS.workflowClass,student_id:QA_IDS.student,enrollment_id:QA_IDS.enrollment,trainer_id:QA_IDS.trainer,note:INTERNAL_NOTE,updated_at:new Date().toISOString(),
  });
  if(error)throw error;

  const trainer=await roleClient('trainer');
  const {data:trainerRows,error:trainerError}=await trainer.from('learning_observation_internal_notes').select('note').eq('schedule_event_id',QA_IDS.workflowClass);
  if(trainerError)throw trainerError;
  expect(trainerRows?.some(x=>x.note===INTERNAL_NOTE)).toBe(true);

  const parent=await roleClient('parent');
  const {data:parentRows,error:parentError}=await parent.from('learning_observation_internal_notes').select('note').eq('schedule_event_id',QA_IDS.workflowClass);
  if(parentError)throw parentError;
  expect(parentRows).toEqual([]);
 });
});
