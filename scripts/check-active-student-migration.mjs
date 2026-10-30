import fs from 'node:fs';
import {readCanonicalSql} from './read-canonical-sql.mjs';

const checks=[
 ['canonical schema modules',['migration_type','opening_completed_sessions','opening_completed_minutes','learning_observation_internal_notes','enrollment_opening_progress_trigger','source text not null default \'portal\'']],
 ['lib/repository.ts',['openingCompletedSessions','openingCompletedMinutes','learning_observation_internal_notes']],
 ['app/admin/enrollments/page.tsx',['Existing active student · carry forward progress','OPENING COMMERCIAL POSITION','createOpeningFinanceSnapshot']],
 ['components/operations/ClassRecordEditor.tsx',['Parent-visible progress note','Internal trainer / admin note']],
 ['app/admin/page.tsx',['near completion','learner birthday']],
];
let failed=false;
for(const [file,markers] of checks){
 const text=file==='canonical schema modules'?readCanonicalSql():fs.readFileSync(file,'utf8');
 for(const marker of markers){if(!text.includes(marker)){console.error(`Missing ${JSON.stringify(marker)} in ${file}`);failed=true;}}
}
if(failed)process.exit(1);
console.log('Active-student migration structure check passed.');
