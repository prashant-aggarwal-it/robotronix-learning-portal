import fs from 'node:fs';
import path from 'node:path';
import {readCanonicalSql} from './read-canonical-sql.mjs';

const root=process.cwd();
const schema=readCanonicalSql();
const repo=fs.readFileSync(path.join(root,'lib','communication-repository.ts'),'utf8');
const required=[
  "recipient_role='trainer' and trainer_id=public.current_trainer_id()",
  "recipient_role='parent'",
  "recipient_role='student'",
  'mark_communication_thread_read',
  'set_communication_thread_status',
  'prepare_communication_message',
  'prepare_communication_thread',
  'alter publication supabase_realtime add table public.portal_notifications',
  'alter publication supabase_realtime add table public.communication_threads',
  'alter publication supabase_realtime add table public.communication_messages',
];
const missing=required.filter(x=>!schema.includes(x));
const forbidden=[
  'create policy communication_threads_parent_update',
  'create policy communication_threads_trainer_update',
];
const unsafe=forbidden.filter(x=>schema.includes(x));
const repoRequired=['subscribeNotifications','subscribeCommunicationThreads','subscribeThreadMessages','supabase.rpc("mark_communication_thread_read"','supabase.rpc("set_communication_thread_status"'];
const repoMissing=repoRequired.filter(x=>!repo.includes(x));
if(missing.length||unsafe.length||repoMissing.length){
  console.error('Communication security/realtime check failed.');
  if(missing.length) console.error('Missing schema controls:',missing);
  if(unsafe.length) console.error('Unsafe direct update policies present:',unsafe);
  if(repoMissing.length) console.error('Missing client controls:',repoMissing);
  process.exit(1);
}
console.log('Communication security/realtime static check passed.');
