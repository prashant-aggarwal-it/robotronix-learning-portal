# Robotronix Education Suite — Database

**START HERE.** Follow the numbered folders in order. The module folders contain internal source files, not additional installation steps.

| Order | Folder | Purpose |
| --- | --- | --- |
| 01 | [01_reset](01_reset/README.md) | DEV-only reset and safety |
| 02 | [02_install](02_install/README.md) | Generate the complete Education Suite installer |
| 03 | [03_reference](03_reference/README.md) | Master and configuration data |
| 04 | [04_users](04_users/README.md) | Create Auth accounts and assign organization roles |
| 05 | [05_seed](05_seed/README.md) | Optional DEV sample data |
| 06 | [06_verify](06_verify/README.md) | Database and multitenant security tests |
| 07 | [07_operations](07_operations/README.md) | Provider integrations and scheduled jobs |

## Current state

The DEV application reset has already been performed; Auth users have been removed by the operator. The **complete Education Suite installer is generated but UNTESTED for clean-install compatibility**. Do not run it until certification succeeds.

The installer generator is:

```powershell
node scripts/build-education-suite-installer.mjs
```

The generated output is `generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql`.

## Source code (not instructions to execute)

`portal/`, `crm/`, `tasks/`, `saas/`, `platform/`, `shared/`, `packages.json` and `generated/` remain the current canonical source and generator dependencies. Running them separately would duplicate or conflict with a consolidated install. The newer SaaS builder is an assembled draft, not a certified fresh installation.

`audit/`, `legacy/`, `connect/`, `04_existing_db_migrations/` and `security_qa/` still need reference auditing before removal. Avoid executing those historical sources.

**DEV:** `uzzuquxeeqonxeqcuohh` · **PROD (never reset):** `njyktzenybimykpqaegn`.
