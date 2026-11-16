// Read-only check to prevent the operator verification scripts from drifting from canonical SQL.
import fs from 'node:fs';
import path from 'node:path';
const pairs=[
 ['database/portal/verify.sql','database/06_verify/01_academy.sql'],
 ['database/tasks/04_verify.sql','database/06_verify/02_tasks.sql'],
 ['database/crm/04_verify.sql','database/06_verify/03_crm.sql'],
 ['database/saas/39_phase3c_readiness_readonly.sql','database/06_verify/04_saas_membership.sql']
];
let failures=0;
for (const [source,target] of pairs) {
 const a=path.join(process.cwd(),source),b=path.join(process.cwd(),target);
 if (!fs.existsSync(a)||!fs.existsSync(b)||!fs.readFileSync(a).equals(fs.readFileSync(b))) {
  console.error('FAIL outdated or missing operator SQL: '+target+' (canonical: '+source+')'); failures++;
 } else console.log('PASS '+target);
}
if (failures) process.exitCode=1;
