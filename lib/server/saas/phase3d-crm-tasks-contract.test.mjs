import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("database/shared/integrations/02_tasks_crm.sql","utf8");
test("CRM to Tasks status sync cannot modify records for a mismatched owner",()=>{
 assert.match(sql,/l\.task_id=t\.id and t\.owner_user_id=l\.owner_user_id and l\.module='connect'/);
 assert.match(sql,/m\.tenant_id=l\.tenant_id and m\.user_id=l\.owner_user_id and m\.status='active'/);
});
test("Task to CRM bridge requires active CRM membership and scoped assignee",()=>{
 assert.match(sql,/c\.tenant_id=l\.tenant_id and c\.id=l\.resource_id/);
 assert.match(sql,/c\.assignee_membership_id=m\.id or m\.role in/);
});
