# 04 — Auth users and organization roles

After schema installation and security verification, create DEV test Auth users via `npm run qa:create-users` with private QA passwords. This creates Auth identities; it does not grant SaaS tenant memberships.

Create owner accounts using `/signup`, then use organization invitations and app onboarding for Admin, Trainer, Parent and Student access. **Never write directly to `auth.users` in SQL.**
