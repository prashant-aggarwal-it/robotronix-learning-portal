import {test,expect} from '@playwright/test';
import {ensureRoleSession} from './session';
import {assertHealthyScreen,formGroup,openAndCheck} from './helpers';
import {QA_IDS,assertQaLinkage,cleanupQaOnboarding,getOnboardingAdminNotification,getQaOnboarding,qaDb,resetWorkflowEnrollment} from './qa-db';

const ONBOARDING_CHILD='SANITY-AUTO Onboarding Child';

test.describe('Production readiness — public and auth',()=>{
  test('public homepage has the intended family entry choices and renders cleanly',async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('link',{name:/Start family onboarding/i})).toBeVisible();
    await expect(page.getByRole('link',{name:/Existing user\? Sign in/i})).toBeVisible();
    await expect(page.getByText('Feel the progress.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('login is role-neutral and routes from one sign-in screen',async({page})=>{
    await page.goto('/login',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('heading',{name:'Sign in to Robotronix'})).toBeVisible();
    await expect(page.getByText(/parents, students, trainers and administrators/i)).toBeVisible();
    await expect(page.getByRole('button',{name:'Sign in'})).toBeVisible();
    await expect(page.getByRole('link',{name:/Start family onboarding/i})).toBeVisible();
  });
});

test.describe('Production readiness — parent onboarding and admin handoff',()=>{
  test.beforeEach(async({page})=>ensureRoleSession(page,'parent'));

  test.beforeEach(async()=>cleanupQaOnboarding(ONBOARDING_CHILD));
  test.afterEach(async()=>cleanupQaOnboarding(ONBOARDING_CHILD));

  test('parent submits two distinct WhatsApp contacts, preferences persist, Admin notification is created',async({page})=>{
    await page.goto('/onboarding',{waitUntil:'domcontentloaded'});
    await assertHealthyScreen(page,'/onboarding');

    // The live onboarding page loads the signed-in family's defaults asynchronously.
    // Wait for that load to finish before entering test values, otherwise the defaults
    // can arrive a moment later and overwrite fields Playwright has already filled.
    const familyEmail=formGroup(page,'Family account email *').locator('input');
    await expect(familyEmail).toHaveValue(/\S+@\S+/,{timeout:15_000});

    await formGroup(page,'Name *').locator('input').first().fill('SANITY-AUTO Parent');
    const phone1=page.locator('.phoneField').filter({hasText:'WhatsApp number 1'}).locator('.phoneNumber');
    const phone2=page.locator('.phoneField').filter({hasText:'WhatsApp number 2'}).locator('.phoneNumber');
    await phone1.fill('9999999101');
    await phone2.fill('9999999102');

    await formGroup(page,'Child’s full name *').locator('input').fill(ONBOARDING_CHILD);
    await formGroup(page,'Date of birth *').locator('input').fill('2014-01-15');
    await formGroup(page,'Grade / Class *').locator('select').selectOption('Class 6');
    await formGroup(page,'School *').locator('input').fill('SANITY-AUTO School');
    await formGroup(page,'Address Line 1 *').locator('input').fill('QA Test Address');
    await formGroup(page,'Postal / ZIP Code *').locator('input').fill('110001');

    const continueButton=page.getByRole('button',{name:'Continue'});
    const continueBox=await continueButton.boundingBox();
    const cardBox=await page.locator('.onboardingCard').boundingBox();
    if(continueBox&&cardBox)expect(continueBox.x).toBeGreaterThan(cardBox.x+cardBox.width/2);
    await continueButton.click();

    await expect(page.getByRole('heading',{name:'Learning preferences'})).toBeVisible();
    await page.getByRole('button',{name:'Robotics & Smart Automations',exact:true}).click();
    await page.getByRole('button',{name:'Coding for Beginners',exact:true}).click();
    await formGroup(page,'What is the main learning goal? *').locator('select').selectOption('Build practical projects');
    await formGroup(page,'Coding experience *').locator('select').selectOption('Beginner');
    await formGroup(page,'Robotics experience *').locator('select').selectOption('Beginner');
    await formGroup(page,'How did you hear about Robotronix™? *').locator('select').selectOption('Referral');

    await page.getByRole('button',{name:'Mon'}).click();
    await page.getByLabel('Monday available from').fill('17:00');
    await page.getByLabel('Monday available until').fill('19:00');
    await page.getByRole('button',{name:'Sat'}).click();
    await page.getByLabel('Saturday available from').fill('10:00');
    await page.getByLabel('Saturday available until').fill('12:00');

    await page.locator('.consentBox input[type="checkbox"]').check();
    await page.getByRole('button',{name:'Submit onboarding'}).click();
    await expect(page.getByText('Setup submitted',{exact:true})).toBeVisible({timeout:15000});

    const row=await getQaOnboarding(ONBOARDING_CHILD);
    expect(row).toBeTruthy();
    expect(String(row.primary_whatsapp)).toContain('9999999101');
    expect(String(row.alternate_whatsapp)).toContain('9999999102');
    expect(row.preferred_class_days).toEqual(expect.arrayContaining(['Monday','Saturday']));
    expect(String(row.preferred_time_windows)).toContain('Monday: 17:00–19:00');
    expect(String(row.preferred_time_windows)).toContain('Saturday: 10:00–12:00');
    expect(row.interests).toEqual(expect.arrayContaining(['Robotics & Smart Automations','Coding for Beginners']));
    expect(row.goal).toBe('Build practical projects');

    const notification=await getOnboardingAdminNotification(row.id);
    expect(notification?.recipient_role).toBe('admin');
    expect(notification?.priority).toBe('action');
    expect(notification?.href).toBe(`/admin/onboarding/${row.id}`);
  });

  test('duplicate WhatsApp numbers are blocked before Step 2',async({page})=>{
    await page.goto('/onboarding',{waitUntil:'domcontentloaded'});
    const familyEmail=formGroup(page,'Family account email *').locator('input');
    await expect(familyEmail).toHaveValue(/\S+@\S+/,{timeout:15_000});
    await formGroup(page,'Name *').locator('input').first().fill('SANITY-AUTO Parent');
    const phone1=page.locator('.phoneField').filter({hasText:'WhatsApp number 1'}).locator('.phoneNumber');
    const phone2=page.locator('.phoneField').filter({hasText:'WhatsApp number 2'}).locator('.phoneNumber');
    await phone1.fill('9999999101');await phone2.fill('9999999101');
    await formGroup(page,'Child’s full name *').locator('input').fill(ONBOARDING_CHILD);
    await formGroup(page,'Date of birth *').locator('input').fill('2014-01-15');
    await formGroup(page,'Grade / Class *').locator('select').selectOption('Class 6');
    await formGroup(page,'School *').locator('input').fill('SANITY-AUTO School');
    await formGroup(page,'Address Line 1 *').locator('input').fill('QA Test Address');
    await formGroup(page,'Postal / ZIP Code *').locator('input').fill('110001');
    await page.getByRole('button',{name:'Continue'}).click();
    await expect(page.getByText(/different second WhatsApp number/i)).toBeVisible();
    await expect(page.getByRole('heading',{name:'Family & child details'})).toBeVisible();
  });
});

test.describe('Production readiness — Admin operational views',()=>{
  test.beforeEach(async({page})=>ensureRoleSession(page,'admin'));

  test('QA learner enrollment history uses readable status and one schedule row per day',async({page})=>{
    await resetWorkflowEnrollment();
    await page.goto(`/admin/students/${QA_IDS.student}`,{waitUntil:'domcontentloaded'});
    await expect(
      page.locator('table .statusBadge.status-active').filter({hasText:'Active'}).first()
    ).toBeVisible();
    const schedule=page.locator('.weeklyScheduleLines').first();
    await expect(schedule).toBeVisible();
    await expect(schedule.getByText('Mon',{exact:true})).toBeVisible();
    await expect(schedule.getByText('Wed',{exact:true})).toBeVisible();
  });

  test('enrollment detail displays title-case program model and status',async({page})=>{
    await page.goto(`/admin/enrollments/${QA_IDS.enrollment}`,{waitUntil:'domcontentloaded'});
    await expect(page.getByText('Fixed Program',{exact:true})).toBeVisible();
    await expect(page.getByText('Active',{exact:true})).toBeVisible();
  });

  test('billing panel uses the existing Admin session instead of asking Admin to sign in again',async({page})=>{
    await page.goto(`/admin/enrollments/${QA_IDS.enrollment}#billing-invoice`,{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('heading',{name:'Fee package and invoice'})).toBeVisible();
    await expect(page.getByText('Loading billing status…')).toBeHidden({timeout:15000});
    await expect(page.getByText(/Sign in as an administrator/i)).toHaveCount(0);
  });

  test('Admin onboarding setup separates availability snapshot from detailed schedule matching',async({page})=>{
    const db=qaDb();
    const childName='SANITY-AUTO Schedule Matching Child';

    // Create a deterministic non-active onboarding record for this UI check.
    await cleanupQaOnboarding(childName);

    const {data,error}=await db
      .from('onboarding_submissions')
      .insert({
        login_email:'qa-parent@robotronix.local',
        primary_contact:'guardian',
        primary_whatsapp:'+919999999101',
        alternate_whatsapp:'+919999999102',
        primary_guardian_name:'SANITY-AUTO Parent',
        primary_guardian_relationship:'guardian',
        primary_guardian_mobile:'+919999999101',
        city:'Delhi',
        state:'Delhi',
        country:'India',
        timezone:'Asia/Kolkata',
        address_line1:'QA Test Address',
        postal_code:'110001',
        child_name:childName,
        child_dob:'2014-01-15',
        grade:'Class 6',
        school:'SANITY-AUTO School',
        preferred_class_days:['Monday','Saturday'],
        preferred_time_windows:'Monday: 17:00–19:00\nSaturday: 10:00–12:00',
        interests:['Robotics & Smart Automations','Coding for Beginners'],
        goal:'Build practical projects',
        coding_experience:'Beginner',
        robotics_experience:'Beginner',
        source:'Referral',
        data_consent:true,
        status:'new'
      })
      .select('id')
      .single();

    if(error)throw error;

    try{
      await page.goto(`/admin/onboarding/${data.id}`,{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('heading',{name:'Availability snapshot'})).toBeVisible();
      await expect(page.getByText('SCHEDULE MATCHING',{exact:true})).toBeVisible();
      await expect(page.getByText(/Preferred timings vs trainer availability/i)).toBeVisible();
      await expect(page.getByText('FINAL CLASS PLAN',{exact:true})).toBeVisible();
    }finally{
      await cleanupQaOnboarding(childName);
    }
  });
});

test.describe('Production readiness — Trainer, parent and DB linkage',()=>{
  test('seeded QA relationships remain internally consistent',async()=>{
    const result=await assertQaLinkage();
    expect(result.trainer.id).toBe(QA_IDS.trainer);
    expect(result.parentLink.student_id).toBe(QA_IDS.student);
    expect(result.enrollment.trainer_id).toBe(QA_IDS.trainer);
    expect(result.enrollment.student_id).toBe(QA_IDS.student);
    expect(result.enrollment.status).toBe('active');
  });

  test.describe('trainer',()=>{
    test.beforeEach(async({page})=>ensureRoleSession(page,'trainer'));
    test('trainer schedule shows recurring availability with view-first edit control',async({page})=>{
      await page.goto('/trainer/schedule',{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('heading',{name:'Your working hours'})).toBeVisible();
      const hasSummary=await page.locator('.weeklyAvailabilitySummary').isVisible();
      expect(hasSummary).toBe(true);
      const buttons=page.getByRole('button',{name:'Edit availability'});
      if(await buttons.count())await expect(buttons.first()).toBeVisible();
    });

    test('trainer sees assigned learner under Learner Progress',async({page})=>{
      await page.goto('/trainer/progress',{waitUntil:'domcontentloaded'});
      await expect(page.getByText('QA Student',{exact:true})).toBeVisible();
    });
  });

  test.describe('parent',()=>{
    test.beforeEach(async({page})=>ensureRoleSession(page,'parent'));
    test('parent sees only linked QA learner experience',async({page})=>{
      await page.goto(`/parent/learner/${QA_IDS.student}`,{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('heading',{name:'QA Robotics Foundations'})).toBeVisible({timeout:15000});
      await expect(page.locator('body')).not.toContainText('Trainer Payroll');
    });
  });
});

test.describe('Production readiness — persistence and refresh',()=>{
  test.beforeEach(async({page})=>ensureRoleSession(page,'admin'));
  for(const route of [`/admin/students/${QA_IDS.student}`,`/admin/enrollments/${QA_IDS.enrollment}`]){
    test(`${route} survives browser refresh`,async({page})=>{
      await page.goto(route,{waitUntil:'domcontentloaded'});await assertHealthyScreen(page,route);
      await page.reload({waitUntil:'domcontentloaded'});await assertHealthyScreen(page,route);
    });
  }
});
