# 02 — Install the complete Education Suite

**NOT YET CLEAN-INSTALL CERTIFIED — DO NOT EXECUTE THE CONSOLIDATED SUITE INSTALLER YET.**

From repository root:

```powershell
node scripts/build-education-suite-installer.mjs
```

Review `../generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql`. It combines the Academy, CRM, Tasks, SaaS and onboarding sources; compilation/concatenation is not proof of successful clean installation. Do not separately execute internal `portal/`, `crm/`, `tasks/` or `saas/` files.
