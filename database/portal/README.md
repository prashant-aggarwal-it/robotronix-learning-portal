# Learning Portal database

- `manifest.json` is the ordered canonical Portal source list.
- `schema/`: 13 authoritative Portal SQL modules.
- `reference/`: 4 reference-data SQL modules.
- `verify.sql`: read-only verification after install.
- `first_admin_example.sql`: optional admin bootstrap after creating an Auth account.
- `qa/`: DEV-only synthetic role profiles, test data and QA assertions.

**Do not run the source modules one by one.** Run `npm run db:build-installers` from the repository root and select a single generated installer (Portal-only or the desired combination). Never run a fresh installer on an already populated installation.

For DEV QA, first create eight confirmed Auth identities, then run `qa/01_profiles.sql`, `qa/02_data.sql`, `qa/03_verify.sql` after `verify.sql` succeeds. CRM QA role mapping is separately in `../crm/qa/`.

See [the one installation guide](../README.md).
