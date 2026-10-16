import { test, expect } from '@playwright/test';
import { ensureRoleSession } from './session';
import { QA_IDS, qaDb } from './qa-db';

test.setTimeout(75_000);

function birthdayTomorrow(){
  const d=new Date();d.setUTCDate(d.getUTCDate()+1);
  const mm=String(d.getUTCMonth()+1).padStart(2,'0');
  const dd=String(d.getUTCDate()).padStart(2,'0');
  return `2012-${mm}-${dd}`;
}

test.describe('Pre-go-live active learner safeguards',()=>{
  test('Admin dashboard surfaces upcoming birthday and near-completion renewal warning',async({page})=>{
    const db=qaDb();
    const [{data:student,error:se},{data:enrollment,error:ee}]=await Promise.all([
      db.from('students').select('dob').eq('id',QA_IDS.student).single(),
      db.from('enrollments').select('planned_sessions,sessions_completed,status').eq('id',QA_IDS.enrollment).single(),
    ]);
    if(se)throw se;if(ee)throw ee;
    const originalDob=student.dob;
    const originalPlanned=enrollment.planned_sessions;
    const originalStatus=enrollment.status;
    const completed=Number(enrollment.sessions_completed||0);
    try{
      const {error:studentUpdate}=await db.from('students').update({dob:birthdayTomorrow(),record_status:'active'}).eq('id',QA_IDS.student);
      if(studentUpdate)throw studentUpdate;
      const {error:enrollmentUpdate}=await db.from('enrollments').update({status:'active',planned_sessions:Math.max(completed+4,4)}).eq('id',QA_IDS.enrollment);
      if(enrollmentUpdate)throw enrollmentUpdate;

      await ensureRoleSession(page,'admin');
      await page.goto('/admin',{waitUntil:'domcontentloaded'});
      await expect(page.getByText(/learner birthday.*next 7 days/i)).toBeVisible({timeout:20_000});
      await expect(page.getByText(/enrollment.*near completion/i)).toBeVisible({timeout:20_000});
      await expect(page.getByText(/4 or fewer sessions remain/i)).toBeVisible({timeout:20_000});
    } finally {
      await db.from('students').update({dob:originalDob}).eq('id',QA_IDS.student);
      await db.from('enrollments').update({planned_sessions:originalPlanned,status:originalStatus}).eq('id',QA_IDS.enrollment);
    }
  });
});
