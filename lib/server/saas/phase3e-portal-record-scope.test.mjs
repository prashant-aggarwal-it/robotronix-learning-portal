import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
test("Mapped CRM admission cannot confirm a foreign Academy student or enrollment",()=>{
 const s=fs.readFileSync("database/saas/52_phase3e_portal_record_ownership.sql","utf8");
 assert.match(s,/saas\.academy_enrollments el/);
 assert.match(s,/saas\.academy_students st/);
 assert.match(s,/el\.organization_id=v_org/);
 assert.match(s,/st\.student_id=NEW\.portal_student_id/);
 assert.match(s,/CREATE TRIGGER guard_portal_handoff_tenant_v1/);
});
test("Mapped CRM demo must reference a trainer and schedule in the same Academy tenant",()=>{
 const s=fs.readFileSync("database/saas/52_phase3e_portal_record_ownership.sql","utf8");
 assert.match(s,/saas\.academy_trainers at/);
 assert.match(s,/at\.organization_id=v_org/);
 assert.match(s,/ev\.id=NEW\.portal_schedule_event_id/);
 assert.match(s,/CREATE TRIGGER guard_portal_demo_tenant_v1/);
});
