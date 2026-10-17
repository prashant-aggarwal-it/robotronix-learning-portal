import { test, expect, type Locator, type Page } from '@playwright/test';
import { ensureRoleSession } from './session';
import { QA_IDS, qaDb } from './qa-db';

/**
 * Production-style E2E coverage for the scheduling exception lifecycle.
 *
 * This suite intentionally uses the real Admin UI for:
 *   - creating a class
 *   - rejecting a true schedule conflict
 *   - rescheduling while preserving the original occurrence
 *   - cancelling the linked replacement
 *
 * Service-role DB access is used only for deterministic setup/cleanup and
 * authoritative verification. All test records are clearly SANITY-labelled.
 */
test.setTimeout(75_000);

const QA_NOTE_PREFIX = 'SANITY-AUTO scheduling lifecycle';
const AVAILABILITY_REASON = `${QA_NOTE_PREFIX} availability`;
const INITIAL_NOTE = `${QA_NOTE_PREFIX} initial class`;
const UI_SCHEDULE_NOTE = `${QA_NOTE_PREFIX} UI scheduled class`;
const RESCHEDULE_REASON = 'SANITY-AUTO parent requested schedule change';

function datePlus(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function group(container: Page | Locator, labelText: string) {
  return container
    .locator('.formGroup')
    .filter({ has: container.locator('label').filter({ hasText: labelText }) })
    .first();
}

async function cleanupSchedulingLifecycle() {
  const db = qaDb();

  const { data: rows, error: eventLookupError } = await db
    .from('schedule_events')
    .select('id,rescheduled_to_id,original_event_id')
    .ilike('notes', `${QA_NOTE_PREFIX}%`);

  if (eventLookupError) throw eventLookupError;

  const ids = new Set<string>();
  for (const row of rows ?? []) {
    if (row.id) ids.add(row.id);
    if (row.rescheduled_to_id) ids.add(row.rescheduled_to_id);
    if (row.original_event_id) ids.add(row.original_event_id);
  }

  // Pick up linked replacement rows even if their note was changed later.
  if (ids.size) {
    const seedIds = [...ids];
    const { data: linked, error: linkedError } = await db
      .from('schedule_events')
      .select('id')
      .in('original_event_id', seedIds);
    if (linkedError) throw linkedError;
    for (const row of linked ?? []) ids.add(row.id);
  }

  if (ids.size) {
    const allIds = [...ids];

    // Remove deterministic notifications created by the schedule DB trigger.
    for (const id of allIds) {
      const { error: notificationError } = await db
        .from('portal_notifications')
        .delete()
        .like('dedupe_key', `${id}:%`);
      if (notificationError) throw notificationError;
    }

    // These are dedicated SANITY records. If a previous failed run got far enough
    // to create attendance/progress/payroll rows, remove only those dependent QA
    // rows first so the production history guard can remain strict for real data.
    for (const table of ['trainer_earnings', 'learning_observations', 'class_attendance'] as const) {
      const { error: dependentDeleteError } = await db
        .from(table)
        .delete()
        .in('schedule_event_id', allIds);
      if (dependentDeleteError) throw dependentDeleteError;
    }

    // Break original -> replacement links before deleting the rows.
    const { error: unlinkError } = await db
      .from('schedule_events')
      .update({ rescheduled_to_id: null })
      .in('id', allIds);
    if (unlinkError) throw unlinkError;

    const { error: deleteError } = await db
      .from('schedule_events')
      .delete()
      .in('id', allIds);
    if (deleteError) throw deleteError;
  }

  const { error: overrideDeleteError } = await db
    .from('trainer_availability_overrides')
    .delete()
    .eq('trainer_id', QA_IDS.trainer)
    .eq('reason', AVAILABILITY_REASON);
  if (overrideDeleteError) throw overrideDeleteError;
}

async function addQaAvailability(date: string) {
  const db = qaDb();
  const { error } = await db.from('trainer_availability_overrides').insert({
    trainer_id: QA_IDS.trainer,
    date,
    start_time: '14:00',
    end_time: '22:00',
    override_type: 'available',
    reason: AVAILABILITY_REASON,
  });
  if (error) throw error;
}

async function seedInitialClass(date: string) {
  const db = qaDb();
  const id = crypto.randomUUID();

  const { error } = await db.from('schedule_events').insert({
    id,
    trainer_id: QA_IDS.trainer,
    course_id: QA_IDS.course,
    enrollment_id: QA_IDS.enrollment,
    student_id: QA_IDS.student,
    title: 'QA Robotics Foundations · QA Student',
    date,
    start_time: '18:00',
    end_time: '19:00',
    timezone: 'Asia/Kolkata',
    event_type: 'class',
    delivery_mode: 'one_to_one',
    status: 'scheduled',
    notes: INITIAL_NOTE,
    occurrence_kind: 'regular',
    requested_by: 'admin',
  });

  if (error) throw error;
  return id;
}

async function selectQaEnrollment(dialog: Locator) {
  const search = dialog.getByPlaceholder('Search learner, course or trainer…');
  await search.fill('QA Student');
  const option = dialog.locator('.searchableSelectMenu button').filter({ hasText: 'QA Student' }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
}

async function scheduleQaClassThroughUi(
  page: Page,
  date: string,
  startTime: string,
  note: string,
) {
  await page.getByRole('button', { name: '+ Schedule item', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add schedule item' });
  await expect(dialog).toBeVisible();

  await selectQaEnrollment(dialog);
  await dialog.locator('input[type="date"]').first().fill(date);
  // Use input types inside this modal rather than text-matching the label. The
  // schedule form has one date and one time input, making these stable across
  // label/required-marker rendering changes.
  await dialog.locator('input[type="time"]').first().fill(startTime);
  await dialog.locator('.formGroup').filter({ hasText: 'Duration' }).locator('select').selectOption('60');
  await dialog.locator('input[placeholder="Optional operational note"]').fill(note);
  await dialog.getByRole('button', { name: 'Save schedule item', exact: true }).click();

  return dialog;
}

async function getEventByNote(note: string) {
  const db = qaDb();
  const { data, error } = await db
    .from('schedule_events')
    .select('*')
    .eq('notes', note)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function expectNotification(eventId: string, type: string) {
  const db = qaDb();
  await expect
    .poll(
      async () => {
        const { data, error } = await db
          .from('portal_notifications')
          .select('id,type,dedupe_key')
          .eq('type', type)
          .like('dedupe_key', `${eventId}:%`);
        if (error) throw error;
        return (data ?? []).length;
      },
      { timeout: 12_000 },
    )
    .toBeGreaterThan(0);
}

test.describe('Scheduling lifecycle — create, conflict, reschedule and cancel', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupSchedulingLifecycle();
    await ensureRoleSession(page, 'admin');
  });

  test.afterEach(async () => {
    await cleanupSchedulingLifecycle();
  });

  test('Admin schedules a QA class and a true overlapping booking is rejected', async ({ page }) => {
    const classDate = datePlus(60);
    await addQaAvailability(classDate);

    await page.goto('/admin/schedule', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Loading schedule data…')).toBeHidden({ timeout: 15_000 });

    await scheduleQaClassThroughUi(page, classDate, '18:00', UI_SCHEDULE_NOTE);
    await expect(page.locator('.successBanner')).toContainText('Schedule updated successfully.', { timeout: 15_000 });

    await expect
      .poll(async () => Boolean(await getEventByNote(UI_SCHEDULE_NOTE)), { timeout: 12_000 })
      .toBe(true);

    const created = await getEventByNote(UI_SCHEDULE_NOTE);
    expect(created?.enrollment_id).toBe(QA_IDS.enrollment);
    expect(created?.trainer_id).toBe(QA_IDS.trainer);
    expect(created?.student_id).toBe(QA_IDS.student);
    expect(created?.status).toBe('scheduled');
    expect(String(created?.start_time).slice(0, 5)).toBe('18:00');

    await expectNotification(created.id, 'class_scheduled');

    // Attempt the exact same trainer/learner slot. The UI must surface the
    // production conflict rule and must not insert a duplicate class.
    await scheduleQaClassThroughUi(
      page,
      classDate,
      '18:00',
      `${QA_NOTE_PREFIX} conflict attempt`,
    );

    await expect(page.locator('.errorBanner')).toContainText(
      /Trainer is already occupied during this time|Learner already has another class during this time/i,
      { timeout: 12_000 },
    );

    const duplicate = await getEventByNote(`${QA_NOTE_PREFIX} conflict attempt`);
    expect(duplicate).toBeNull();
  });

  test('Admin reschedules with linked history, then cancels the replacement', async ({ page }) => {
    const originalDate = datePlus(62);
    const replacementDate = datePlus(63);

    await addQaAvailability(originalDate);
    await addQaAvailability(replacementDate);
    const originalId = await seedInitialClass(originalDate);

    await page.goto(`/admin/classes/${originalId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Scheduled', { exact: true })).toBeVisible({ timeout: 15_000 });

    const actions = page.locator('details.secondaryActions');
    await expect(actions).toBeVisible();
    await actions.locator('summary').click();
    await actions.getByRole('button', { name: 'Reschedule class', exact: true }).click();

    const box = page.locator('.rescheduleBox');
    await expect(box).toBeVisible();
    await box.locator('input[type="date"]').fill(replacementDate);
    await box.locator('input[type="time"]').fill('19:30');
    await box.locator('select').filter({ has: page.locator('option[value="parent"]') }).selectOption('parent');
    await box.locator('select').filter({ has: page.locator('option[value="60"]') }).selectOption('60');
    await box.getByPlaceholder('e.g. Parent requested change due to school exam').fill(RESCHEDULE_REASON);
    await box.getByRole('button', { name: 'Create replacement class', exact: true }).click();

    await expect(page.locator('.successBanner')).toContainText(
      'Original class preserved and linked replacement class scheduled successfully.',
      { timeout: 15_000 },
    );

    const db = qaDb();
    let replacementId = '';

    await expect
      .poll(
        async () => {
          const { data: original, error: originalError } = await db
            .from('schedule_events')
            .select('status,rescheduled_to_id,change_reason')
            .eq('id', originalId)
            .single();
          if (originalError) throw originalError;

          if (!original?.rescheduled_to_id) return 'waiting';
          replacementId = original.rescheduled_to_id;

          const { data: replacement, error: replacementError } = await db
            .from('schedule_events')
            .select('status,original_event_id,occurrence_kind,date,start_time,change_reason')
            .eq('id', replacementId)
            .single();
          if (replacementError) throw replacementError;

          const ok =
            original.status === 'rescheduled' &&
            original.change_reason === RESCHEDULE_REASON &&
            replacement.status === 'scheduled' &&
            replacement.original_event_id === originalId &&
            replacement.occurrence_kind === 'rescheduled_replacement' &&
            replacement.date === replacementDate &&
            String(replacement.start_time).slice(0, 5) === '19:30' &&
            replacement.change_reason === RESCHEDULE_REASON;

          return ok ? 'ready' : 'waiting';
        },
        { timeout: 15_000 },
      )
      .toBe('ready');

    expect(replacementId).not.toBe('');
    await expectNotification(originalId, 'class_rescheduled');
    await expectNotification(replacementId, 'class_scheduled');

    // Now cancel the replacement via the actual Admin class UI.
    await page.goto(`/admin/classes/${replacementId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Scheduled', { exact: true })).toBeVisible({ timeout: 15_000 });

    const replacementActions = page.locator('details.secondaryActions');
    await replacementActions.locator('summary').click();
    await replacementActions.getByRole('button', { name: 'Cancel class', exact: true }).click();

    await expect(page.locator('.successBanner')).toContainText('Class marked Cancelled.', { timeout: 12_000 });

    await expect
      .poll(
        async () => {
          const { data, error } = await db
            .from('schedule_events')
            .select('status')
            .eq('id', replacementId)
            .single();
          if (error) throw error;
          return data.status;
        },
        { timeout: 12_000 },
      )
      .toBe('cancelled');

    await expectNotification(replacementId, 'class_cancelled');

    // Historical integrity: original remains Rescheduled and linked to the
    // now-cancelled replacement instead of being overwritten or deleted.
    const { data: original, error: finalError } = await db
      .from('schedule_events')
      .select('status,rescheduled_to_id')
      .eq('id', originalId)
      .single();
    if (finalError) throw finalError;
    expect(original.status).toBe('rescheduled');
    expect(original.rescheduled_to_id).toBe(replacementId);
  });
});
