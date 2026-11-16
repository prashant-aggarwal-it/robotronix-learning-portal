# Robotronix Education Suite — Platform Ownership, Tenancy & Onboarding

**Status:** Approved product/architecture direction (16 November 2026); **not** a claim that all flows are implemented or tested.  
**Repository:** `prashant-aggarwal-it/robotronix-learning-portal`  
**Working branch:** `feature/education-suite-phase3g`  
**DEV Supabase:** `uzzuquxeeqonxeqcuohh` · **PROD Supabase:** `njyktzenybimykpqaegn` (do not modify as part of DEV work).

## 1. Business model and confirmed decision

Robotronix is both:

1. **Robotronix Education Suite**, the SaaS system provider that owns and operates the shared platform; and
2. **Robotronix Academy**, the **first customer organization/tenant** using the same Academy, CRM and Tasks products that external customers will use.

Other customers include academies, coaching/training institutes and individual tutors. A sole tutor still gets an organization/tenant so data ownership, billing and access policies remain consistent.

**Design rule:** Platform ownership and organization ownership are separate scopes, even if the same human holds both for Robotronix.

## 2. Ownership and authorization model

| Scope | Role | Responsibilities | Access boundary |
| --- | --- | --- | --- |
| Platform | Platform Super Admin | Manage SaaS organizations, plans/entitlements, platform settings and support operations | Restricted platform control plane; no blanket access to tenant student/financial data |
| Tenant | Organization Owner | Own and configure an academy/tutor organization, invite staff, manage its subscription and modules | Own organization only |
| Tenant | Admin | Manage delegated operations within one organization | Explicitly granted tenant permissions |
| Tenant | Trainer | Assigned teaching, class and learner workflows | Assigned tenant and permitted records |
| Tenant | Parent | View authorized learners, messages, billing as enabled | Only linked learners in tenant |
| Tenant | Student | Access own classes, learning content and progress | Own authorized records |

A person can belong to multiple organizations and have different roles in each. Platform Super Admin is **not** a public signup choice, nor a synonym for Academy Owner. No direct cross-tenant data access is granted merely because an operator manages the platform. Any support access should be explicit, scoped, auditable and time-limited where feasible.

## 3. First boot: Robotronix as SaaS operator

After a successful DEV database install (see `database/INSTALLATION_GUIDE.md`):

1. **Secure platform bootstrap:** provision the first Robotronix Platform Super Admin through a controlled, authenticated operator workflow. It must not be self-assignable via public signup, user metadata or editable profile fields.
2. **Create first tenant:** create **Robotronix Academy** through the same organization model used by other customers.
3. **Assign tenant ownership:** give the designated account the Organization Owner role in Robotronix Academy. One account may also be Platform Super Admin, but platform and tenant authorization checks must remain distinct.
4. **Set entitlements:** enable Academy, CRM and Tasks for Robotronix Academy using the tenant/module entitlement mechanism.
5. **Configure business:** academy profile, courses, trainers, students, batches/cohorts, schedules, fees, and workflows.
6. **Validate separation:** use a second independent test tenant to confirm there is no unauthorized cross-tenant visibility.

Platform provisioning is a **planned requirement** until code paths, security and QA have been verified; this document does not prescribe unverified SQL or imply a bootstrap endpoint already exists.

## 4. Customer signup and first-run experience

### New academy / institute

1. Sign up or sign in using supported authentication (email/Google as configured).
2. Choose **Academy / Institute**.
3. Create organization (name, business type, optional contact details).
4. Become Organization Owner of **that** organization after verified server-side onboarding.
5. Choose or receive enabled modules (Academy, CRM, Tasks) according to plan/trial/entitlements.
6. Complete organization setup (courses, team, learners, fees and schedules).
7. Enter organization dashboard.

### Individual tutor

Use the same flow but select **Individual Tutor**. Create a tenant for the tutor even when there is only one user. Offer simpler setup defaults and the same tenant isolation guarantees.

### Existing member

Sign in, select the appropriate organization if a member of several, and see only its entitled modules and authorized features. An invitation should be verified and accepted before assigning membership. A Parent/Student/Trainer must not be offered unrestricted organization creation or ownership by virtue of their tenant role.

### Public first screen

- **Create an academy/institute account**
- **Start as an individual tutor**
- **Sign in**

Do **not** expose “Register as Platform Super Admin.” Platform administration lives behind a separate protected route/interface and server-side authorization.

## 5. SaaS product/modules

- **Academy:** courses, cohorts, trainers, learners, classes, attendance, progress, messaging, fees and finance features according to deployment.
- **CRM / Connect:** enquiries, leads, follow-ups, communication channels, demos and conversion workflows.
- **My Tasks:** personal/team task workflows scoped by organization and explicit sharing rules.
- **Platform control plane:** organizations, memberships, plans/entitlements, platform operations and audited support capabilities.

Entitlements determine which modules an organization can use. **Entitlements do not replace role authorization or database row-level security.** Feature availability and role permissions must be checked server-side, not only hidden in navigation.

## 6. Data and security principles

1. **One shared SaaS app and initially one shared Supabase database**, with tenant ownership, central authentication and strict RLS. Dedicated databases per tenant are a possible future deployment option, not the current default.
2. Every tenant-owned record must have a trustworthy ownership relationship (direct tenant ID or securely resolved parent ownership).
3. Never trust a tenant ID, role or platform-admin flag solely from client input. Verify current membership and role on the server and in RLS/security-definer logic.
4. Prevent tenant-to-tenant reads, writes, joins, file access and background-job leakage. Test with two or more real DEV identities and organizations.
5. Platform-wide administration should use narrowly scoped privileges and auditable actions, rather than unrestricted normal tenant access.
6. Authentication identities are created via supported Supabase Auth workflows; **do not insert directly into `auth.users`**.
7. Users, organization memberships, tenant entitlements and reference data are distinct setup concerns.
8. DEV reset and reinstall are separate from Auth, Storage and third-party integration configuration.

## 7. Implementation plan (extend existing system; do not rebuild)

| Priority | Workstream | Acceptance criterion |
| --- | --- | --- |
| P0 | Audit existing SaaS/organization/auth implementation | Inventory existing routes, tables, policies, role and entitlement checks; identify gaps before editing |
| P1 | Secure Platform Super Admin bootstrap | Initial admin created only through restricted process; no public escalation path |
| P1 | Robotronix Academy tenant setup | First tenant created; owner assigned; Academy/CRM/Tasks entitlements configured |
| P1 | Public customer onboarding | Academy and tutor signup create isolated tenants and verified owners |
| P1 | Membership and invitations | Admin, Trainer, Parent and Student onboarding works with correct tenant boundaries |
| P1 | Tenant isolation certification | Cross-tenant access denied at UI/API/RLS/Storage boundaries |
| P2 | Platform control-plane UI | Operator can manage organizations and entitlements without exposing tenant private data |
| P2 | Subscription/trial lifecycle | Document and implement plan selection, expiry and renewal behavior |
| P2 | Operational readiness | Audit logs, support access, monitoring, error handling and onboarding recovery |

**No production changes, merges or deployments are authorized by this document.** Implement and certify on DEV first.

## 8. End-to-end acceptance scenarios

- Platform admin can manage organization metadata and entitlements but cannot casually browse private tenant records.
- Robotronix Academy operates as an ordinary tenant with Academy, CRM and Tasks.
- An unrelated academy can self-onboard without seeing Robotronix Academy data.
- An individual tutor can self-onboard and use a single-user organization.
- A user belonging to two organizations can switch contexts without role/record leakage.
- An invited trainer, parent or student sees only authorized records.
- Direct API calls with forged organization IDs or edited roles are rejected.
- RLS tests use authenticated user sessions and verify both read and write isolation.
- Module disabled for a tenant is enforced in server routes, not only navigation.
- QA verifies logout/login, owner invitation recovery and unsuccessful/partial onboarding.
- Platform bootstrap is idempotent or has a safe recovery procedure, without public privilege escalation.

## 9. What is confirmed vs. pending

**Confirmed product decisions:** Robotronix is the platform provider **and** first tenant; external academies and individual tutors get separate tenants; Platform Super Admin and Organization Owner are separate roles/scopes; Academy, CRM and Tasks are the intended tenant modules; shared multi-tenant app/database is the initial architecture.

**Not yet established by this document:** exact current implementation completeness, schema/table names, actual admin bootstrap command, working customer onboarding, subscription billing, and full tenant isolation certification. These require a repository/DEV audit and executable tests.

## 10. Related operator documentation

- [Database master installation guide](../../database/INSTALLATION_GUIDE.md)
- [Database numbered workflow](../../database/README.md)
- [Auth users and organization roles](../../database/04_users/README.md)
- [DEV verification](../../database/06_verify/README.md)
- [Operations](../../database/07_operations/README.md)

**Maintenance:** Update this document when a product decision changes; update the database installation guide only when the executable installation/onboarding process changes. Keep architecture intent separate from verified implementation status.
