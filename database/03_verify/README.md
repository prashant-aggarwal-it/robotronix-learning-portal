# Release/schema verification

`01_VERIFY_RELEASE.sql` is the **current read-only** check for the production-equivalent database installation.

Run after executing `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` on an empty DEV public schema, **before** inserting QA business data.

Supabase SQL Editor may display only the final result set. Confirm the complete SQL execution succeeded with no errors. This is **not** a substitute for `database/02_qa/03_VERIFY_DEV_QA.sql`, which verifies synthetic user/business records.
