import test from "node:test";
import assert from "node:assert/strict";
import {ROLE_CAPABILITIES,roleHasCapability,requireRoleCapability} from "./role-capabilities.mjs";

test("unknown roles and unknown capabilities deny by default",()=>{
 for(const role of ["", "platform_admin","super_admin","ADMIN","unknown",null,undefined]) {
  assert.equal(roleHasCapability(role,"academy.finance.manage"),false);
 }
 assert.equal(roleHasCapability("owner","crm.contacts.manage"),false);
 assert.equal(roleHasCapability("owner","tasks.own.manage"),false);
 assert.equal(roleHasCapability("owner","academy.unknown"),false);
});
test("tenant-admin and owner have Academy management, trainer does not have finance",()=>{
 assert.equal(roleHasCapability("owner","academy.students.manage"),true);
 assert.equal(roleHasCapability("admin","academy.students.manage"),true);
 assert.equal(roleHasCapability("admin","saas.members.manage"),true);
 assert.equal(roleHasCapability("admin","saas.roles.manage"),false);
 assert.equal(roleHasCapability("trainer","academy.finance.manage"),false);
 assert.equal(roleHasCapability("trainer","academy.payroll.manage"),false);
 assert.equal(roleHasCapability("member","academy.students.read"),false);
});
test("trainer capability is scoped and does not authorize other learners",()=>{
 assert.equal(roleHasCapability("trainer","academy.attendance.manage"),true);
 // This grant is necessary, not sufficient. Record-level checks remain mandatory.
 assert.equal(roleHasCapability("trainer","saas.members.manage"),false);
});
test("capability denial is explicit",()=>{
 assert.throws(()=>requireRoleCapability("member","academy.students.read"),
  error=>error.status===403);
 assert.doesNotThrow(()=>requireRoleCapability("owner","academy.courses.manage"));
});
test("role capability definitions are immutable",()=>{
 assert.ok(Object.isFrozen(ROLE_CAPABILITIES));
 for(const list of Object.values(ROLE_CAPABILITIES))assert.ok(Object.isFrozen(list));
});
