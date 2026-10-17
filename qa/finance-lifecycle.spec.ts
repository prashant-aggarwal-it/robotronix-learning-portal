import { test, expect } from '@playwright/test';
import { ensureRoleSession } from './session';
import { QA_IDS, qaDb } from './qa-db';

test.setTimeout(75_000);
const PREFIX='SANITY-AUTO Finance';
const NAME=`${PREFIX} Package`;
const NEG_NAME=`${PREFIX} Negative Package`;
const REF='SANITY-FIN-RECEIPT-001';

function isoDateFrom(base:string,days=0){const d=new Date(`${base}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
async function freePeriod(){
 const db=qaDb();
 const {data,error}=await db.from('student_fee_packages').select('end_date').eq('enrollment_id',QA_IDS.enrollment).order('end_date',{ascending:false}).limit(1);
 if(error)throw error;
 const base=(data?.[0]?.end_date && data[0].end_date>=today())?isoDateFrom(data[0].end_date,2):today();
 return {start:base,end:isoDateFrom(base,30),due:base};
}
async function cleanup(){
 const db=qaDb();
 const {data,error}=await db.from('student_fee_packages').select('id').like('name',`${PREFIX}%`);
 if(error)throw error;
 const ids=(data??[]).map((x:any)=>x.id);
 if(ids.length){
  const {error:pErr}=await db.from('student_fee_payments').delete().in('package_id',ids);if(pErr)throw pErr;
  const {error:fErr}=await db.from('student_fee_packages').delete().in('id',ids);if(fErr)throw fErr;
 }
}

test.describe('Student finance lifecycle',()=>{
 test.beforeEach(async({page})=>{await cleanup();await ensureRoleSession(page,'admin')});
 test.afterEach(async()=>{await cleanup()});

 test('Admin creates fee package, records payment, and ledger balance changes',async({page})=>{
  const period=await freePeriod();
  await page.goto(`/admin/finance?enrollment=${QA_IDS.enrollment}&newPackage=1`,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Add student package'})).toBeVisible({timeout:15_000});
  const form=page.locator('form.financeForm').filter({hasText:'Add student package'});
  await form.locator('select[name="enrollment"]').selectOption(QA_IDS.enrollment);
  await form.locator('input[name="name"]').fill(NAME);
  await form.locator('select[name="currency"]').selectOption('INR');
  await form.locator('input[name="amount"]').fill('2000');
  await form.locator('input[name="sessions"]').fill('8');
  await form.locator('input[name="start"]').fill(period.start);
  await form.locator('input[name="end"]').fill(period.end);
  const dueInputs=form.locator('input[type="date"]');
  await dueInputs.last().fill(period.due);
  const amountInputs=form.locator('input[type="number"]');
  await amountInputs.last().fill('2000');
  await form.getByRole('button',{name:'Save package'}).click();

  const db=qaDb();
  await expect.poll(async()=>{
   const {data}=await db.from('student_fee_packages').select('id').eq('name',NAME).maybeSingle();return Boolean(data);
  },{timeout:15_000}).toBe(true);
  const{data:pkg,error:pe}=await db.from('student_fee_packages').select('*').eq('name',NAME).single();if(pe)throw pe;
  expect(Number(pkg.amount)).toBe(2000);
  await expect(page.getByRole('status')).toContainText('Saved successfully.',{timeout:15_000});

  // save() publishes the success notice before its ledger reload finishes, so wait for
  // the package form to close before starting the next UI action. Using the row-level
  // Payment action also selects the exact package we just created.
  await expect(page.getByRole('heading',{name:'Add student package',exact:true})).toBeHidden({timeout:15_000});
  await page.getByLabel('Search student packages').fill(NAME);
  const createdRow=page.locator('tbody tr').filter({hasText:NAME});
  await expect(createdRow).toBeVisible({timeout:15_000});
  await createdRow.getByRole('button',{name:'Payment',exact:true}).click();
  const pay=page.locator('form.financeForm').filter({hasText:'Record money received or refunded'});
  await expect(pay).toBeVisible({timeout:15_000});
  const packageSelect=pay.locator('select[name="package"]');
  await expect(packageSelect).toHaveValue(pkg.id,{timeout:15_000});
  await pay.locator('input[name="amount"]').fill('750');
  await pay.locator('input[name="date"]').fill(today());
  await pay.locator('select[name="method"]').selectOption('UPI');
  await pay.locator('input[name="reference"]').fill(REF);
  await pay.getByRole('button',{name:'Save entry'}).click();
  await expect.poll(async()=>{
   const {data}=await db.from('student_fee_payments').select('id').eq('package_id',pkg.id).eq('reference',REF).maybeSingle();return Boolean(data);
  },{timeout:15_000}).toBe(true);
  await expect(page.getByRole('status')).toContainText('Saved successfully.',{timeout:15_000});

  const{data:payment,error:re}=await db.from('student_fee_payments').select('*').eq('package_id',pkg.id).eq('reference',REF).single();if(re)throw re;
  expect(Number(payment.amount)).toBe(750);
  await page.getByLabel('Search student packages').fill(NAME);
  const row=page.locator('tbody tr').filter({hasText:NAME});
  await expect(row).toContainText('2,000');
  await expect(row).toContainText('750');
  await expect(row).toContainText('1,250');
 });

 test('duplicate payment reference and future-dated payment are rejected',async({page})=>{
  const db=qaDb();const id=crypto.randomUUID();const period=await freePeriod();
  const{error:e1}=await db.from('student_fee_packages').insert({id,enrollment_id:QA_IDS.enrollment,name:NEG_NAME,scheme:'Monthly',currency:'INR',amount:1000,sessions:4,start_date:period.start,end_date:period.end,installments:[{due:period.due,amount:1000}]});if(e1)throw e1;
  const{error:e2}=await db.from('student_fee_payments').insert({id:crypto.randomUUID(),package_id:id,amount:200,payment_date:today(),method:'UPI',reference:REF,kind:'payment'});if(e2)throw e2;

  await page.goto('/admin/finance',{waitUntil:'domcontentloaded'});
  // Open payment from the exact SANITY package row. This avoids racing the initial
  // finance reload and proves the row-level payment action selects the right package.
  await page.getByLabel('Search student packages').fill(NEG_NAME);
  const negativeRow=page.locator('tbody tr').filter({hasText:NEG_NAME});
  await expect(negativeRow).toBeVisible({timeout:15_000});
  await negativeRow.getByRole('button',{name:'Payment',exact:true}).click();
  const pay=page.locator('form.financeForm').filter({hasText:'Record money received or refunded'});
  await expect(pay).toBeVisible({timeout:15_000});
  const packageSelect=pay.locator('select[name="package"]');
  await expect(packageSelect).toHaveValue(id,{timeout:15_000});
  await pay.locator('input[name="amount"]').fill('100');
  await pay.locator('input[name="date"]').fill(today());
  await pay.locator('input[name="reference"]').fill(REF);
  await pay.getByRole('button',{name:'Save entry'}).click();
  await expect(page.locator('.financeError')).toContainText('reference already exists',{timeout:10_000});
  const {count:dupCount,error:dcErr}=await db.from('student_fee_payments').select('*',{count:'exact',head:true}).eq('package_id',id).eq('reference',REF);if(dcErr)throw dcErr;
  expect(dupCount).toBe(1);

  // A future date is rejected by the browser form constraint before repository/DB mutation.
  const date=pay.locator('input[name="date"]');
  const tomorrow=isoDateFrom(today(),1);
  await date.fill(tomorrow);
  await pay.locator('input[name="reference"]').fill('SANITY-FIN-FUTURE-001');
  await expect(date).toHaveAttribute('max',today());
  expect(await date.evaluate((el:HTMLInputElement)=>el.checkValidity())).toBe(false);
  await pay.getByRole('button',{name:'Save entry'}).click();
  const {count:futureCount,error:fcErr}=await db.from('student_fee_payments').select('*',{count:'exact',head:true}).eq('package_id',id).eq('reference','SANITY-FIN-FUTURE-001');if(fcErr)throw fcErr;
  expect(futureCount).toBe(0);
 });
});
