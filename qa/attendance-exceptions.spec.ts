import { test, expect } from '@playwright/test';
import { ensureRoleSession } from './session';
import { QA_IDS, qaDb, resetWorkflowClass } from './qa-db';

test.setTimeout(60_000);

async function enrollmentProgress() {
  const db = qaDb();
  // The DB stores attendance-derived session/progress counters. Instructional hours are
  // intentionally derived from conducted schedule_events + attended/late attendance rows
  // in lib/course-hours.ts; there is no enrollments.hours_completed column.
  const { data, error } = await db.from('enrollments').select('sessions_completed,progress_percent').eq('id', QA_IDS.enrollment).single();
  if (error) throw error;
  return { sessions: Number(data?.sessions_completed ?? 0), progress: Number(data?.progress_percent ?? 0) };
}

async function completeAs(page: any, status: 'absent' | 'excused') {
  await page.goto(`/trainer/classes/${QA_IDS.workflowClass}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /QA Robotics Class/i })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Attendance', { exact: true }).selectOption(status);
  await expect(page.locator('.missedClassNote')).toBeVisible();
  await page.getByRole('button', { name: 'Save & Complete Class', exact: true }).click();
  await expect(page.locator('.successBanner')).toContainText('Class completed', { timeout: 15_000 });
}

test.describe('Attendance exception lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkflowClass();
    await ensureRoleSession(page, 'trainer');
  });

  test.afterEach(async () => { await resetWorkflowClass(); });

  test('student no-show is persisted, creates zero-pay no_show earning, and does not increase learner progress', async ({ page }) => {
    const before = await enrollmentProgress();
    await completeAs(page, 'absent');
    const db = qaDb();

    const { data: attendance, error: ae } = await db.from('class_attendance').select('status').eq('schedule_event_id', QA_IDS.workflowClass).eq('student_id', QA_IDS.student).single();
    if (ae) throw ae;
    expect(attendance.status).toBe('absent');

    const { data: earning, error: ee } = await db.from('trainer_earnings').select('class_outcome,total_amount,status').eq('schedule_event_id', QA_IDS.workflowClass).single();
    if (ee) throw ee;
    expect(earning.class_outcome).toBe('no_show');
    expect(Number(earning.total_amount)).toBe(0);

    const after = await enrollmentProgress();
    expect(after.sessions).toBe(before.sessions);
    expect(after.progress).toBe(before.progress);

    const { count, error: oe } = await db.from('learning_observations').select('id', { count: 'exact', head: true }).eq('schedule_event_id', QA_IDS.workflowClass).eq('student_id', QA_IDS.student);
    if (oe) throw oe;
    expect(count ?? 0).toBe(0);
  });

  test('excused/missed class does not add learner hours or academic observation', async ({ page }) => {
    const before = await enrollmentProgress();
    await completeAs(page, 'excused');
    const db = qaDb();
    const after = await enrollmentProgress();
    expect(after.sessions).toBe(before.sessions);
    expect(after.progress).toBe(before.progress);
    const { count, error } = await db.from('learning_observations').select('id', { count: 'exact', head: true }).eq('schedule_event_id', QA_IDS.workflowClass);
    if (error) throw error;
    expect(count ?? 0).toBe(0);
  });


  // Paid-payroll immutability is enforced by database triggers and is intentionally
  // not mutated here. A paid earning is irreversible by normal application/service
  // operations, so creating one against the shared workflow fixture would contaminate
  // repeatable QA. The guard remains covered by release/schema verification and manual
  // production-readiness acceptance.

});
