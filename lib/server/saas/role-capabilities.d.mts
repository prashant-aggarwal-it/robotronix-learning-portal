export type OrganizationRole="owner"|"admin"|"staff"|"trainer"|"member";
export type OrganizationCapability =
 |"saas.organization.manage"|"saas.members.manage"|"saas.roles.manage"
 |"academy.students.read"|"academy.students.manage"|"academy.trainers.manage"
 |"academy.courses.manage"|"academy.enrollments.manage"|"academy.schedule.manage"
 |"academy.classes.manage"|"academy.attendance.manage"|"academy.progress.manage"
 |"academy.finance.read"|"academy.finance.manage"|"academy.payroll.manage"
 |"academy.invoices.manage"|"academy.zoom.manage"|"academy.messages.manage"
 |"academy.settings.manage"|"academy.members.manage"
 |"academy.schedule.read"|"academy.classes.read";
export const ROLE_CAPABILITIES:Readonly<Record<OrganizationRole,readonly OrganizationCapability[]>>;
export function roleHasCapability(role:unknown,capability:unknown):boolean;
export function requireRoleCapability(role:unknown,capability:unknown):void;
