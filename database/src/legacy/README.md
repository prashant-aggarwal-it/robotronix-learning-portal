# Historical database development sources

Files in this folder are **not installation entrypoints** and are excluded from all generated installer packages.

- `tasks/`: preserved phased My Tasks SQL and development notes, for historical QA and potential upgrade analysis.
- `tasks/v2/`: 16 historical My Tasks V2 phase scripts (`10`–`25`), archived after static confirmation that their final V2 objects exist in canonical Tasks SQL. Do not apply them after a fresh installer.

Other historical SQL remains temporarily in `database/connect/`, `database/04_existing_db_migrations/`, `database/release_install/` and `database/security_qa/` where some legacy checks may reference exact paths. These folders are visually hidden in VS Code's Explorer by `.vscode/settings.json`; they have **not been deleted**. An eventual deletion requires a dependency inventory and replacement of every migration/QA consumer first.

For current installs, use `database/README.md` and `npm run db:build-installers`.
