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
