import { test, expect, type Page } from '@playwright/test';
import { ensureRoleSession, newRoleContext } from './session';
import { QA_IDS, qaDb, resetWorkflowClass, resetWorkflowEnrollment } from './qa-db';

const ORIGINAL_QA_SCHOOL = 'Robotronix QA School';
const EDITED_QA_SCHOOL = 'Robotronix QA School — Automated Edit';

/**
 * The current portal form markup uses:
 *
 *   <div class="formGroup">
 *     <label>School *</label>
 *     <input ... />
 *   </div>
 *
 * rather than htmlFor/id-linked labels, so Playwright getByLabel() is not the
 * correct locator for these controls. Locate the formGroup by its visible label
 * and then locate the input/select inside that group.
 */
function formGroup(page: Page, labelText: string) {
  return page
    .locator('.formGroup')
    .filter({
      has: page.locator('label').filter({ hasText: labelText }),
    })
    .first();
}

function formInput(page: Page, labelText: string) {
  return formGroup(page, labelText).locator('input').first();
}

function formSelect(page: Page, labelText: string) {
  return formGroup(page, labelText).locator('select').first();
}

async function resetQaStudentSchool() {
  const db = qaDb();

  const { error } = await db
    .from('students')
    .update({
      school: ORIGINAL_QA_SCHOOL,
      updated_at: new Date().toISOString(),
    })
    .eq('id', QA_IDS.student);

  if (error) throw error;
}

async function expectQaStudentSchool(expectedSchool: string) {
  const db = qaDb();

  await expect
    .poll(
      async () => {
        const { data, error } = await db
          .from('students')
          .select('school')
          .eq('id', QA_IDS.student)
          .single();

        if (error) throw error;
        return data?.school ?? '';
      },
      {
        timeout: 12_000,
        message: `Expected QA learner school to be "${expectedSchool}"`,
      },
    )
    .toBe(expectedSchool);
}

async function expectQaEnrollmentStatus(expectedStatus: string) {
  const db = qaDb();

  await expect
    .poll(
      async () => {
        const { data, error } = await db
          .from('enrollments')
          .select('status')
          .eq('id', QA_IDS.enrollment)
          .single();

        if (error) throw error;
        return data?.status ?? '';
      },
      {
        timeout: 12_000,
        message: `Expected QA enrollment status to be "${expectedStatus}"`,
      },
    )
    .toBe(expectedStatus);
}

test.describe('Critical operational workflows — admin', () => {
  test.beforeEach(async ({ page }) => ensureRoleSession(page, 'admin'));

  test('admin can update QA learner and restore original value', async ({ page }) => {
    await resetQaStudentSchool();

    try {
      await page.goto(`/admin/students/${QA_IDS.student}`, {
        waitUntil: 'domcontentloaded',
      });

      // Student editing is intentionally hidden inside a view-first <details>.
      const editDisclosure = page.locator('details.profileEditDisclosure');
      await expect(editDisclosure).toBeVisible({ timeout: 15_000 });

      const editSummary = editDisclosure.locator('summary');
      await expect(editSummary).toContainText('Edit student & family details');

      await editSummary.click();

      const school = formInput(page, 'School *');

      await expect(school).toBeVisible({ timeout: 10_000 });
      await expect(school).toHaveValue(ORIGINAL_QA_SCHOOL);

      // Change the school and save.
      await school.fill(EDITED_QA_SCHOOL);

      const saveStudent = page.getByRole('button', {
        name: 'Save student',
        exact: true,
      });

      await expect(saveStudent).toBeEnabled();
      await saveStudent.click();

      // If the form rejects the save, surface the actual validation message
      // instead of waiting for a DB timeout.
      const studentError = page.locator('.errorBanner');
      if (await studentError.isVisible().catch(() => false)) {
        throw new Error(
          `Student save was rejected by the UI: ${(await studentError.textContent())?.trim() || 'Unknown validation error'}`,
        );
      }

      // DB persistence is authoritative.
      await expectQaStudentSchool(EDITED_QA_SCHOOL);

      // Current UI changes the button label after a successful save.
      await expect(
        page.getByRole('button', {
          name: 'Student saved',
          exact: true,
        }),
      ).toBeVisible({ timeout: 10_000 });

      await expect(page.locator('.successBanner')).toContainText(
        'Student record saved successfully.',
      );

      // Restore the original value.
      await school.fill(ORIGINAL_QA_SCHOOL);

      const restoreButton = page.getByRole('button', {
        name: 'Save student',
        exact: true,
      });

      await expect(restoreButton).toBeEnabled();
      await restoreButton.click();

      await expectQaStudentSchool(ORIGINAL_QA_SCHOOL);

      await expect(
        page.getByRole('button', {
          name: 'Student saved',
          exact: true,
        }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      // Keep later QA runs deterministic even if an assertion fails.
      await resetQaStudentSchool();
    }
  });

  test('admin can put QA enrollment on hold and return it active', async ({ page }) => {
    await resetWorkflowEnrollment();

    try {
      await page.goto(`/admin/enrollments/${QA_IDS.enrollment}`, {
        waitUntil: 'domcontentloaded',
      });

      // Enrollment detail is view-first.
      const editEnrollment = page.getByRole('button', {
        name: 'Edit enrollment',
        exact: true,
      });

      await expect(editEnrollment).toBeVisible({ timeout: 15_000 });
      await editEnrollment.click();

      const status = formSelect(page, 'Status *');

      await expect(status).toBeVisible({ timeout: 10_000 });
      await expect(status).toHaveValue('active');

      await status.selectOption('on_hold');
      await expect(status).toHaveValue('on_hold');

      const holdPanel = page.locator('.holdPanel');
      await expect(holdPanel).toBeVisible({ timeout: 10_000 });

      const reason = formSelect(page, 'Reason *');
      await expect(reason).toBeVisible({ timeout: 10_000 });

      await reason.selectOption('other');
      await expect(reason).toHaveValue('other');

      const saveEnrollment = page.getByRole('button', {
        name: 'Save enrollment',
        exact: true,
      });

      await expect(saveEnrollment).toBeEnabled();
      await saveEnrollment.click();

      await expectQaEnrollmentStatus('on_hold');

      // A successful save returns to view-first mode.
      await expect(
        page.getByRole('button', {
          name: 'Edit enrollment',
          exact: true,
        }),
      ).toBeVisible({ timeout: 15_000 });

      // Re-enter edit mode and restore Active.
      await page
        .getByRole('button', {
          name: 'Edit enrollment',
          exact: true,
        })
        .click();

      const restoreStatus = formSelect(page, 'Status *');

      await expect(restoreStatus).toBeVisible({ timeout: 10_000 });
      await expect(restoreStatus).toHaveValue('on_hold');

      await restoreStatus.selectOption('active');
      await expect(restoreStatus).toHaveValue('active');

      const restoreEnrollment = page.getByRole('button', {
        name: 'Save enrollment',
        exact: true,
      });

      await expect(restoreEnrollment).toBeEnabled();
      await restoreEnrollment.click();

      await expectQaEnrollmentStatus('active');

      await expect(
        page.getByRole('button', {
          name: 'Edit enrollment',
          exact: true,
        }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      // Ensure later QA runs always start with an active enrollment.
      await resetWorkflowEnrollment();
    }
  });
});

test.describe('Critical operational workflows — delivery chain', () => {
  test.beforeEach(async ({ page }) => ensureRoleSession(page, 'trainer'));

  test(
    'trainer completes QA class, earning is generated, parent and student see progress',
    async ({ browser, page }) => {
      // This end-to-end workflow covers trainer completion, DB verification,
      // parent visibility and student visibility. Give the complete workflow
      // enough time on slower local/CI runs without adding arbitrary sleeps.
      test.setTimeout(120_000);

      await resetWorkflowClass();

      await page.goto(`/trainer/classes/${QA_IDS.workflowClass}`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(
        page.getByRole('heading', {
          name: /Attendance & learning outcome/i,
        }),
      ).toBeVisible({ timeout: 20_000 });

      await page
        .getByLabel('Topic / activity')
        .fill('QA automated class completion');

      await page
        .getByLabel('Project worked on')
        .fill('QA Sensor Challenge');

      await page
        .getByLabel('Skills practiced')
        .fill('Sensors, debugging');

      await page
        .getByLabel('Attendance', { exact: true })
        .selectOption('attended');

      await page
        .getByLabel('Learning status')
        .selectOption('on_track');

      await page
        .getByLabel('What went well')
        .fill('Completed the QA sensor task independently.');

      await page
        .getByLabel('Next class focus')
        .fill('Extend the logic with another sensor condition.');

      // Current class workflow separates family-visible feedback from the
      // private Trainer/Admin operational note.
      const parentVisibleNote = page.getByLabel(/Parent-visible progress note/i);
      await expect(parentVisibleNote).toBeVisible({ timeout: 20_000 });
      await parentVisibleNote.fill('QA automated progress note.');

      const internalTrainerNote = page.getByLabel(
        /Internal trainer \/ admin note/i,
      );
      await expect(internalTrainerNote).toBeVisible({ timeout: 20_000 });
      await internalTrainerNote.fill(
        'QA private operational note — must remain hidden from Parent and Student.',
      );

      const completeClass = page.getByRole('button', {
        name: 'Save & Complete Class',
      });
      await expect(completeClass).toBeEnabled({ timeout: 10_000 });
      await completeClass.click();

      await expect(
        page.getByText(
          /Class completed\. Learner progress and trainer earning ledger updated successfully\./,
        ),
      ).toBeVisible({ timeout: 20_000 });

      const db = qaDb();

      const { data: event, error: eventError } = await db
        .from('schedule_events')
        .select('status,actual_duration_minutes')
        .eq('id', QA_IDS.workflowClass)
        .single();

      if (eventError) throw eventError;

      expect(event.status).toBe('conducted');
      expect(Number(event.actual_duration_minutes)).toBeGreaterThan(0);

      const { data: earning, error: earningError } = await db
        .from('trainer_earnings')
        .select('status,total_amount,class_outcome')
        .eq('schedule_event_id', QA_IDS.workflowClass)
        .single();

      if (earningError) throw earningError;

      expect(earning.class_outcome).toBe('completed');
      expect(['pending', 'approved']).toContain(earning.status);
      expect(Number(earning.total_amount)).toBeGreaterThanOrEqual(0);

      const { context: parentContext, page: parentPage } = await newRoleContext(
        browser,
        'parent',
      );

      try {
        await parentPage.goto(`/parent/learner/${QA_IDS.student}`, {
          waitUntil: 'domcontentloaded',
        });

        await expect(parentPage.locator('.experienceLoading')).toBeHidden({
          timeout: 20_000,
        });

        await expect(
          parentPage.getByRole('heading', {
            name: 'QA Robotics Foundations',
          }),
        ).toBeVisible({ timeout: 15_000 });

        await expect(
          parentPage.getByText(
            /instructional hours completed|learning sessions attended/i,
          ),
        ).toBeVisible({ timeout: 15_000 });
      } finally {
        await parentContext.close();
      }

      const { context: studentContext, page: studentPage } = await newRoleContext(
        browser,
        'student',
      );

      try {
        await studentPage.goto('/student/course', {
          waitUntil: 'domcontentloaded',
        });

        // The student course page can briefly finish its loading shell before
        // Supabase-backed course data has propagated/rendered. Retry the real
        // business outcome instead of treating the loading indicator as proof
        // that the course is ready.
        await expect(async () => {
          await studentPage.reload({ waitUntil: 'domcontentloaded' });

          await expect(
            studentPage.getByRole('heading', {
              name: 'QA Robotics Foundations',
            }),
          ).toBeVisible({ timeout: 10_000 });
        }).toPass({
          timeout: 45_000,
          intervals: [2_000, 3_000, 5_000],
        });

        await expect(
          studentPage.getByText('Mentor QA Trainer', { exact: true }),
        ).toBeVisible({ timeout: 15_000 });
      } finally {
        await studentContext.close();
      }
    },
  );
});
