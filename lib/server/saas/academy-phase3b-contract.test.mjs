import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page=fs.readFileSync("app/saas/academy/page.tsx","utf8");
const report=fs.readFileSync("database/saas/13_academy_ownership_preflight_readonly.sql","utf8");
test("Academy organization switching invalidates stale data before loading new tenant",()=>{
 assert.match(page,/generation\.current\+\+/);
 assert.match(page,/requestedGeneration===generation\.current/);
 assert.match(page,/setRows\(empty\)/);
 assert.match(page,/setDraft\(\{\}\)/);
});
test("Academy ownership preflight never performs destructive SQL",()=>{
 assert.match(report,/saas\.academy_courses/);
 assert.match(report,/WHERE l\.course_id IS NULL/);
 assert.doesNotMatch(report,/\b(?:DELETE|DROP|TRUNCATE|UPDATE|INSERT)\s+(?:FROM\s+|INTO\s+)?(?:public|saas)\./i);
});

test("sensitive Academy resources require service-only owned linkage",()=>{
 const sql=fs.readFileSync("database/saas/14_academy_resource_ownership_guard.sql","utf8");
 for(const name of ["student_invoices","trainer_earnings","zoom_meetings","zoom_recordings"])
  assert.ok(sql.includes("p_kind='"+name+"'"),"missing ownership branch for "+name);
 assert.match(sql,/m\.status='active' AND o\.status='active'/);
 assert.match(sql,/e\.module_key='academy' AND e\.enabled/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.saas_academy_resource_owned\(uuid,uuid,text,uuid\) TO service_role/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.saas_academy_resource_owned\(uuid,uuid,text,uuid\) FROM PUBLIC,anon,authenticated/);
});

test("shared course reference catalog remains service-managed and never grants tenant ownership",()=>{
 const sql=fs.readFileSync("database/saas/15_shared_course_reference_catalog.sql","utf8");
 assert.match(sql,/CREATE TABLE IF NOT EXISTS saas\.academy_course_templates/);
 assert.match(sql,/NOT EXISTS\(SELECT 1 FROM saas\.academy_courses/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON saas\.academy_course_templates FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/GRANT .* TO authenticated/);
});

test("template adoption requires verified membership and creates a distinct tenant owned record",()=>{
 const sql=fs.readFileSync("database/saas/16_adopt_shared_course_template.sql","utf8");
 const api=fs.readFileSync("app/api/platform/academy/course-templates/adopt/route.ts","utf8");
 assert.match(sql,/m\.role_key IN \('owner','admin'\)/);
 assert.match(sql,/m\.status='active'/);
 assert.match(sql,/t\.availability='available'/);
 assert.match(sql,/INSERT INTO saas\.academy_courses\(course_id,organization_id\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.saas_academy_clone_course_template/);
 assert.match(api,/requireAuthorizedTenantRole/);
 assert.match(api,/readBearerToken/);
});

test("SaaS Zoom entry points verify tenant authorization before privileged operations",()=>{
 const files=[
  "app/api/zoom/classroom/[scheduleEventId]/route.ts",
  "app/api/zoom/recordings/[recordingId]/route.ts",
  "app/api/zoom/recordings/[recordingId]/stream/route.ts"
 ];
 for(const file of files){
  const source=fs.readFileSync(file,"utf8");
  assert.match(source,/verifyZoomTenantScope/,file+" must enforce tenant ownership");
 }
 const adapter=fs.readFileSync("lib/server/saas/legacy-zoom-scope.ts","utf8");
 assert.match(adapter,/saas_authorized_organizations/);
 assert.match(adapter,/data!==false/);
});
test("SaaS revocations cannot downgrade to legacy privileged access",()=>{
 const sql=fs.readFileSync("database/saas/32_revoked_user_rls_marker.sql","utf8");
 const finance=fs.readFileSync("lib/server/saas/legacy-finance-scope.ts","utf8");
 assert.match(sql,/saas\.user_membership_history/);
 assert.match(finance,/saas_actor_ever_member/);
 assert.match(finance,/No active Academy organization membership/);
});
test("existing Academy roles initialize organization before loading data",()=>{
 const guard=fs.readFileSync("components/RoleGuard.tsx","utf8");
 assert.match(guard,/setAcademyBrowserOrganizationContext/);
 assert.match(guard,/\/api\/platform\/organizations/);
 assert.match(guard,/selection!=="ready"/);
});
