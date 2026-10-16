import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {authStatePath} from './auth-state';
import {loadQaEnv} from './env';
import {QA_IDS,qaDb} from './qa-db';

loadQaEnv();

async function browserAccessToken(page:import('@playwright/test').Page){
  await page.goto('/admin',{waitUntil:'domcontentloaded'});
  return page.evaluate(()=>{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i)||'';
      if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
      try{const parsed=JSON.parse(localStorage.getItem(key)||'{}');return parsed?.access_token||parsed?.currentSession?.access_token||''}catch{}
    }
    return '';
  });
}

test.describe('Razorpay / invoice production-readiness',()=>{
  test('invoice API rejects unauthenticated callers',async({request})=>{
    const r=await request.get('/api/admin/invoices');
    expect(r.status()).toBe(401);
  });

  test('webhook rejects an invalid signature',async({request})=>{
    const r=await request.post('/api/razorpay/webhook',{data:{event:'invoice.paid',payload:{}},headers:{'x-razorpay-signature':'invalid'}});
    expect(r.status()).toBe(401);
  });

  test.describe('Admin invoice UI and API',()=>{
    test.use({storageState:authStatePath('admin')});

    test('central invoice ledger loads through authenticated Admin API',async({page})=>{
      await page.goto('/admin/invoices',{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('heading',{name:'Razorpay Invoices'})).toBeVisible();
      await expect(page.getByText(/Sign in as an administrator/i)).toHaveCount(0);
    });

    test('enrollment invoice panel loads through the same authenticated API',async({page})=>{
      await page.goto(`/admin/enrollments/${QA_IDS.enrollment}#billing-invoice`,{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('heading',{name:'Fee package and invoice'})).toBeVisible();
      await expect(page.getByText('Loading billing status…')).toBeHidden({timeout:15000});
      await expect(page.getByText(/Sign in as an administrator/i)).toHaveCount(0);
    });

    test('API payload exposes configured Razorpay mode and package/invoice arrays',async({page})=>{
      const token=await browserAccessToken(page);expect(token).not.toBe('');
      const r=await page.request.get('/api/admin/invoices',{headers:{Authorization:`Bearer ${token}`}});
      expect(r.ok()).toBe(true);const j=await r.json();
      expect(['test','live','unconfigured']).toContain(j.mode);
      expect(Array.isArray(j.invoices)).toBe(true);expect(Array.isArray(j.candidates)).toBe(true);expect(Array.isArray(j.packageSummaries)).toBe(true);
    });

    test('optional Test Mode create/cancel integration uses only a SANITY candidate',async({page})=>{
      test.skip(process.env.QA_RAZORPAY_WRITE!=='1','Set QA_RAZORPAY_WRITE=1 only in Razorpay Test Mode with a SANITY international fee package.');
      const token=await browserAccessToken(page);const headers={Authorization:`Bearer ${token}`};
      const get=await page.request.get('/api/admin/invoices',{headers});expect(get.ok()).toBe(true);const payload=await get.json();
      expect(payload.mode).toBe('test');
      const candidate=(payload.candidates||[]).find((c:any)=>
        /SANITY|QA/i.test(`${c.packageName} ${c.studentName}`) &&
        c.international === true &&
        c.addressComplete === true
      );
      test.skip(!candidate,'No SANITY/QA international invoice candidate with a complete billing profile exists.');
      const fxRes=await page.request.get(`/api/admin/invoices/fx?currency=${encodeURIComponent(candidate.currency)}`,{headers});expect(fxRes.ok()).toBe(true);const fx=await fxRes.json();
      const create=await page.request.post('/api/admin/invoices',{headers,data:{action:'create',packageId:candidate.packageId,exchangeRate:fx.rate,exchangeRateSource:fx.source,fxFetchedAt:fx.fetchedAt,exportEligibilityConfirmed:true}});
      const createBody=await create.text();
      console.log('RAZORPAY CREATE STATUS:',create.status());
      console.log('RAZORPAY CREATE RESPONSE:',createBody);
      expect(create.ok(),`Invoice creation failed (${create.status()}): ${createBody}`).toBe(true);
      const created=JSON.parse(createBody);expect(created.invoice.status).toBe('draft');
      expect(created.invoice.currency).toBe(candidate.currency);
      const cancel=await page.request.post('/api/admin/invoices',{headers,data:{action:'cancel',id:created.invoice.id}});expect(cancel.ok()).toBe(true);
      const cancelled=await cancel.json();expect(cancelled.invoice.status).toBe('cancelled');
    });
  });

  test('invoice schema stores export/LUT, SAC, purpose and immutable snapshot fields',async()=>{
    const db=qaDb();
    const {data,error}=await db.from('student_invoices').select('sac_code,purpose_code,export_under_lut,igst_rate,invoice_number,customer_name,billing_country,fx_rate_to_inr,fx_source').limit(1);
    if(error&&['42P01','PGRST205'].includes(error.code||''))test.skip(true,'Invoice tables are not installed in this QA database.');
    if(error)throw error;
    if(!data?.length)return;
    const row=data[0];
    expect(row.sac_code).toBe('999293');expect(row.purpose_code).toBe('P1107');expect(row.export_under_lut).toBe(true);expect(Number(row.igst_rate)).toBe(0);
  });

  test('optional signed webhook contract accepts a known test invoice event',async({request})=>{
    const secret=process.env.RAZORPAY_WEBHOOK_SECRET||'';const rzpId=process.env.QA_RAZORPAY_WEBHOOK_INVOICE_ID||'';
    test.skip(!secret||!rzpId,'Set RAZORPAY_WEBHOOK_SECRET and QA_RAZORPAY_WEBHOOK_INVOICE_ID for signed webhook integration testing.');
    const body=JSON.stringify({event:'invoice.partially_paid',payload:{invoice:{entity:{id:rzpId,status:'partially_paid',amount_paid:100,amount_due:100,short_url:'https://example.invalid/test'}}}});
    const signature=createHmac('sha256',secret).update(body).digest('hex');
    const response=await request.post('/api/razorpay/webhook',{data:body,headers:{'content-type':'application/json','x-razorpay-signature':signature}});
    expect(response.ok()).toBe(true);
  });
});
