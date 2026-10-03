import { test, expect } from '@playwright/test';
import { authStatePath } from './auth-state';
import { formGroup } from './helpers';
import { QA_IDS, qaDb, resetWorkflowClass, resetWorkflowEnrollment } from './qa-db';

test.describe('Critical operational workflows — admin', () => {
  test.use({ storageState: authStatePath('admin') });

  test('admin can update QA learner and restore original value', async ({ page }) => {
    await page.goto(`/admin/students/${QA_IDS.student}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Edit student & family details').click();
    const school = formGroup(page, 'School *').locator('input');
    await expect(school).toHaveValue('Robotronix QA School');
    await school.fill('Robotronix QA School — Automated Edit');
    await page.getByRole('button', { name: 'Save student' }).click();
    await expect(page.getByText('Student record saved successfully.')).toBeVisible();
    await school.fill('Robotronix QA School');
    await page.getByRole('button', { name: 'Save student' }).click();
    await expect(page.getByText('Student record saved successfully.')).toBeVisible();
  });

  test('admin can put QA enrollment on hold and return it active', async ({ page }) => {
    await resetWorkflowEnrollment();
    await page.goto(`/admin/enrollments/${QA_IDS.enrollment}`, { waitUntil: 'domcontentloaded' });
    const status = formGroup(page, 'Status *').locator('select');
    await status.selectOption('on_hold');
    await expect(status).toHaveValue('on_hold');
    const holdPanel = page.locator('.holdPanel');
    await expect(holdPanel).toBeVisible({ timeout: 8_000 });
    const reason = holdPanel.locator('.formGroup').filter({ hasText: 'Reason *' }).locator('select');
    await expect(reason).toBeVisible();
    await reason.selectOption('other');
    await expect(reason).toHaveValue('other');
    await page.getByRole('button', { name: 'Save enrollment' }).click();
    await expect(page.getByText('Enrollment updated successfully.')).toBeVisible();
    await expect(status).toHaveValue('on_hold');
    await status.selectOption('active');
    await expect(status).toHaveValue('active');
    await expect(page.getByRole('button', { name: 'Save enrollment' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save enrollment' }).click();
    await expect(page.getByText('Enrollment updated successfully.')).toBeVisible();
  });
});

test.describe('Critical operational workflows — delivery chain', () => {
  test.use({ storageState: authStatePath('trainer') });

  test('trainer completes QA class, earning is generated, parent and student see progress', async ({ browser, page }) => {
    await resetWorkflowClass();

    await page.goto(`/trainer/classes/${QA_IDS.workflowClass}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Attendance & learning outcome/i })).toBeVisible();
    await page.getByLabel('Topic / activity').fill('QA automated class completion');
    await page.getByLabel('Project worked on').fill('QA Sensor Challenge');
    await page.getByLabel('Skills practiced').fill('Sensors, debugging');
    await page.getByLabel('Attendance', { exact: true }).selectOption('attended');
    await page.getByLabel('Learning status').selectOption('on_track');
    await page.getByLabel('What went well').fill('Completed the QA sensor task independently.');
    await page.getByLabel('Next class focus').fill('Extend the logic with another sensor condition.');
    await page.getByLabel(/Trainer note/).fill('QA automated progress note.');
    await page.getByRole('button', { name: 'Save & Complete Class' }).click();
    await expect(page.getByText(/Class completed\. Learner progress and trainer earning ledger updated successfully\./)).toBeVisible({ timeout: 15_000 });

    const db = qaDb();
    const { data: event, error: eventError } = await db.from('schedule_events').select('status,actual_duration_minutes').eq('id', QA_IDS.workflowClass).single();
    if (eventError) throw eventError;
    expect(event.status).toBe('conducted');
    expect(Number(event.actual_duration_minutes)).toBeGreaterThan(0);

    const { data: earning, error: earningError } = await db.from('trainer_earnings').select('status,total_amount,class_outcome').eq('schedule_event_id', QA_IDS.workflowClass).single();
    if (earningError) throw earningError;
    expect(earning.class_outcome).toBe('completed');
    expect(['pending','approved']).toContain(earning.status);
    expect(Number(earning.total_amount)).toBeGreaterThanOrEqual(0);

    const parentContext = await browser.newContext({ storageState: authStatePath('parent') });
    const parentPage = await parentContext.newPage();
    await parentPage.goto(`/parent/learner/${QA_IDS.student}`, { waitUntil: 'domcontentloaded' });
    await expect(parentPage.locator('.experienceLoading')).toBeHidden({ timeout: 20_000 });
    await expect(parentPage.getByRole('heading', { name: 'QA Robotics Foundations' })).toBeVisible({ timeout: 5_000 });
    await expect(parentPage.getByText(/instructional hours completed|learning sessions attended/i)).toBeVisible();
    await parentContext.close();

    const studentContext = await browser.newContext({ storageState: authStatePath('student') });
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/student/course', { waitUntil: 'domcontentloaded' });
    await expect(studentPage.locator('.experienceLoading')).toBeHidden({ timeout: 20_000 });
    await expect(studentPage.getByRole('heading', { name: 'QA Robotics Foundations' })).toBeVisible({ timeout: 5_000 });
    await expect(studentPage.getByText('Mentor QA Trainer', { exact: true })).toBeVisible();
    await studentContext.close();
  });
});
