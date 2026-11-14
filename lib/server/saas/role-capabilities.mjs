/**
 * Phase 3C baseline: organization-level capability policy.
 * A capability is necessary but NEVER sufficient for resource access.
 * Callers must additionally verify active membership, enabled module and
 * subject/record ownership through their existing tenant/RLS checks.
 *
 * No platform-global data access is granted by these roles.
 */
export const ROLE_CAPABILITIES = Object.freeze({
 owner: Object.freeze([
  "saas.organization.manage","saas.members.manage","saas.roles.manage",
  "academy.students.read","academy.students.manage","academy.trainers.manage",
  "academy.courses.manage","academy.enrollments.manage","academy.schedule.manage",
  "academy.classes.manage","academy.attendance.manage","academy.progress.manage",
  "academy.finance.read","academy.finance.manage","academy.payroll.manage",
  "academy.invoices.manage","academy.zoom.manage","academy.messages.manage",
  "academy.settings.manage","academy.members.manage"
 ]),
 admin: Object.freeze([
  "academy.students.read","academy.students.manage","academy.trainers.manage",
  "academy.courses.manage","academy.enrollments.manage","academy.schedule.manage",
  "academy.classes.manage","academy.attendance.manage","academy.progress.manage",
  "academy.finance.read","academy.finance.manage","academy.payroll.manage",
  "academy.invoices.manage","academy.zoom.manage","academy.messages.manage",
  "academy.settings.manage","academy.members.manage"
 ]),
 staff: Object.freeze(["academy.students.read","academy.schedule.read","academy.classes.read"]),
 trainer: Object.freeze(["academy.students.read","academy.schedule.read","academy.classes.read",
  "academy.attendance.manage","academy.progress.manage"]),
 member: Object.freeze([])
});
/**
 * Deny by default. Capability grants do not override authorization to
 * individual learners, assignments, financial records or private tasks.
 * CRM and Tasks retain their own independent existing role systems.
 */
export function roleHasCapability(role, capability) {
 if(typeof role!=="string"||typeof capability!=="string")return false;
 if(!/^(academy|saas)\.[a-z][a-z0-9_.]*$/.test(capability))return false;
 return Object.hasOwn(ROLE_CAPABILITIES,role) &&
  ROLE_CAPABILITIES[role].includes(capability);
}
export function requireRoleCapability(role,capability) {
 if(!roleHasCapability(role,capability)) {
  const error=new Error("Organization capability not permitted");
  error.status=403;
  throw error;
 }
}
