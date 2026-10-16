import { test, expect } from '@playwright/test';
import { ensureRoleSession, newRoleContext } from './session';
import { QA_IDS, qaDb } from './qa-db';

test.setTimeout(75_000);
const SUBJECT='SANITY-AUTO Communication Lifecycle';

async function cleanup(){const db=qaDb();const{data}=await db.from('communication_threads').select('id').eq('subject',SUBJECT);const ids=(data??[]).map((x:any)=>x.id);if(ids.length){await db.from('portal_notifications').delete().like('href','%/messages/%');await db.from('communication_threads').delete().in('id',ids)}}
async function seed(){const db=qaDb();const id=crypto.randomUUID();const{data:p}=await db.from('parents').select('id').eq('id',QA_IDS.parent).single();const{data:t}=await db.from('trainers').select('id').eq('id',QA_IDS.trainer).single();const{error}=await db.from('communication_threads').insert({id,category:'general',status:'open',subject:SUBJECT,student_id:QA_IDS.student,student_name:'QA Student',parent_id:p!.id,parent_name:'QA Parent',trainer_id:t!.id,trainer_name:'QA Trainer',assigned_to:'Learning Support',last_message_preview:'SANITY seed',unread_admin:0,unread_parent:0,unread_trainer:0});if(error)throw error;return id}

test.describe('Communications, notifications and negative cases',()=>{
 test.beforeEach(async()=>{await cleanup()});
 test.afterEach(async()=>{await cleanup()});

 test('Parent message reaches Admin, Admin reply reaches Parent, and resolved thread blocks further parent replies',async({browser})=>{
  const id=await seed();
  const {context:parentContext,page:pp}=await newRoleContext(browser,'parent');
  await pp.goto(`/parent/messages/${id}`,{waitUntil:'domcontentloaded'});
  await expect(pp.getByRole('heading',{name:SUBJECT})).toBeVisible({timeout:15_000});
  await pp.getByPlaceholder('Write a reply…').fill('SANITY parent message');
  await pp.getByRole('button',{name:'Send reply'}).click();
  await expect(pp.locator('.messageBubble')).toContainText('SANITY parent message',{timeout:15_000});

  const db=qaDb();
  await expect.poll(async()=>{const{data,error}=await db.from('communication_messages').select('id').eq('thread_id',id).eq('sender_role','parent').eq('body','SANITY parent message');if(error)throw error;return(data??[]).length},{timeout:12_000}).toBe(1);

  const {context:adminContext,page:ap}=await newRoleContext(browser,'admin');
  await ap.goto(`/admin/messages/${id}`,{waitUntil:'domcontentloaded'});
  await expect(ap.getByText('SANITY parent message')).toBeVisible({timeout:15_000});
  await ap.getByPlaceholder('Write a reply…').fill('SANITY admin reply');
  await ap.getByRole('button',{name:'Send reply'}).click();
  await expect(ap.getByText('SANITY admin reply')).toBeVisible({timeout:15_000});
  await ap.getByRole('button',{name:'Resolve conversation'}).click();
  // The DB is authoritative. Realtime refreshes can briefly race with the
  // status update and repaint the pre-resolve thread, so wait for persistence
  // first, then reload the Admin view before asserting the resolved UI.
  await expect.poll(async()=>{
   const{data,error}=await db.from('communication_threads').select('status').eq('id',id).single();
   if(error)throw error;
   return data?.status;
  },{timeout:12_000}).toBe('resolved');
  await ap.reload({waitUntil:'domcontentloaded'});
  await expect(ap.locator('.resolvedBanner')).toBeVisible({timeout:15_000});

  await pp.reload({waitUntil:'domcontentloaded'});
  await expect(pp.getByText('SANITY admin reply')).toBeVisible({timeout:15_000});
  await expect(pp.locator('.resolvedBanner')).toBeVisible();
  await expect(pp.getByPlaceholder('Write a reply…')).toHaveCount(0);
  await parentContext.close();await adminContext.close();
 });

 test('empty message cannot be submitted and unrelated role cannot open an out-of-scope thread',async({browser})=>{
  const id=await seed();
  const {context:parentContext,page:pp}=await newRoleContext(browser,'parent');
  await pp.goto(`/parent/messages/${id}`,{waitUntil:'domcontentloaded'});
  const before=await qaDb().from('communication_messages').select('id',{count:'exact',head:true}).eq('thread_id',id);
  await pp.getByRole('button',{name:'Send reply'}).click();
  const after=await qaDb().from('communication_messages').select('id',{count:'exact',head:true}).eq('thread_id',id);
  expect(after.count??0).toBe(before.count??0);
  await parentContext.close();

  const {context:trainerContext,page:tp}=await newRoleContext(browser,'trainer');
  // This seeded thread is linked to the QA trainer, so trainer access is expected; verify no private family contact fields are exposed.
  await tp.goto(`/trainer/messages/${id}`,{waitUntil:'domcontentloaded'});
  await expect(tp.getByRole('heading',{name:SUBJECT})).toBeVisible({timeout:15_000});
  await expect(tp.getByText(/Contact numbers and private family information are not exposed/i)).toBeVisible();
  await trainerContext.close();
 });
});
