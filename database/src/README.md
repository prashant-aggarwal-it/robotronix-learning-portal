# Internal database SQL sources

This directory contains **implementation and historical migration SQL**, not a separate installation workflow.

- `migrations/`: historical standalone migrations retained for review and release compatibility. **Do not run on a freshly installed Education Suite database.**
- The canonical, actively referenced module sources currently remain in sibling directories `../portal/`, `../crm/`, `../tasks/`, `../saas/`, `../shared/`, `../connect/` and `../platform/`.

## Why not move everything at once?

The existing installer generators, manifests, release checks, tests and historical migration tooling refer to these files by exact paths. Moving them without updating every consumer and testing the entire application would break reproducible installs.

The user-facing workflow is in `../01_reset` through `../07_operations`. The runnable verification SQL is in `../06_verify`.

**No source folder should be deleted merely because it is not part of the user-facing workflow.** Remove a source only after its references are eliminated and CI passes.
