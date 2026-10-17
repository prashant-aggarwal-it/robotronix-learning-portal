import { createClient } from '@supabase/supabase-js';
import { serviceConfig } from './env';

export const QA_IDS = {
  trainer: 'a0000000-0000-4000-8000-000000000001',
  parent: 'b0000000-0000-4000-8000-000000000001',
  course: 'c0000000-0000-4000-8000-000000000001',
  student: 'd0000000-0000-4000-8000-000000000001',
  enrollment: 'e0000000-0000-4000-8000-000000000001',
  workflowClass: 'f0000000-0000-4000-8000-000000000001',
};

export function qaDb() {
  const { url, serviceRoleKey } = serviceConfig();
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for workflow QA reset/verification.');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function resetWorkflowClass() {
  const db = qaDb();
  await db.from('trainer_earnings').delete().eq('schedule_event_id', QA_IDS.workflowClass);
  await db.from('learning_observations').delete().eq('schedule_event_id', QA_IDS.workflowClass);
  await db.from('class_attendance').delete().eq('schedule_event_id', QA_IDS.workflowClass);
  const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().slice(0,10);
  const { error } = await db.from('schedule_events').update({
    date: yesterday,
    start_time: '16:00',
    end_time: '17:00',
    status: 'scheduled',
    actual_duration_minutes: null,
    session_topic: 'QA workflow class',
    project_worked_on: '',
    skills_worked: [],
    updated_at: new Date().toISOString(),
  }).eq('id', QA_IDS.workflowClass);
  if (error) throw error;
}


export async function resetWorkflowEnrollment() {
  const db = qaDb();
  const { error } = await db.from('enrollments').update({
    status: 'active',
    hold_reason: null,
    hold_from: null,
    hold_until: null,
    hold_note: null,
    updated_at: new Date().toISOString(),
  }).eq('id', QA_IDS.enrollment);
  if (error) throw error;

  // Keep the separate hold-history/source table clean for deterministic QA if present.
  const { error: holdDeleteError } = await db.from('enrollment_holds').delete().eq('enrollment_id', QA_IDS.enrollment);
  if (holdDeleteError && holdDeleteError.code !== '42P01' && holdDeleteError.code !== 'PGRST205') {
    throw holdDeleteError;
  }
}

export async function cleanupQaOnboarding(childName='SANITY-AUTO Onboarding Child') {
  const db=qaDb();
  const {data:rows,error}=await db.from('onboarding_submissions').select('id').eq('child_name',childName);
  if(error)throw error;
  const ids=(rows??[]).map((r:any)=>r.id);
  for(const id of ids){
    const {error:notificationError}=await db.from('portal_notifications').delete().eq('href',`/admin/onboarding/${id}`);
    if(notificationError)throw notificationError;
  }
  const {error:deleteError}=await db.from('onboarding_submissions').delete().eq('child_name',childName);
  if(deleteError)throw deleteError;
}

export async function getQaOnboarding(childName='SANITY-AUTO Onboarding Child') {
  const db=qaDb();
  const {data,error}=await db.from('onboarding_submissions').select('*').eq('child_name',childName).order('submitted_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  return data;
}

export async function getOnboardingAdminNotification(onboardingId:string){
  const db=qaDb();
  const {data,error}=await db.from('portal_notifications').select('*').eq('type','onboarding_submitted').eq('href',`/admin/onboarding/${onboardingId}`).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  return data;
}

export async function assertQaLinkage(){
  const db=qaDb();
  const [{data:trainer,error:te},{data:parentLink,error:pe},{data:enrollment,error:ee}]=await Promise.all([
    db.from('trainers').select('id,profile_id,record_status').eq('id',QA_IDS.trainer).single(),
    db.from('parent_students').select('parent_id,student_id').eq('parent_id',QA_IDS.parent).eq('student_id',QA_IDS.student).single(),
    db.from('enrollments').select('id,student_id,trainer_id,course_id,status,schedule_rules').eq('id',QA_IDS.enrollment).single(),
  ]);
  if(te)throw te;if(pe)throw pe;if(ee)throw ee;
  return {trainer,parentLink,enrollment};
}
