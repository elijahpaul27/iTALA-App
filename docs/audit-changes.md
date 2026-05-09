# iTALA Architect Audit Changes

## Implemented

- Added the typed `window.itAPI` preload contract for gradebook workflows.
- Added strict payload validation for grade batch mutations.
- Added batched grade writes with SQLite transactions and `grade_audit` logging.
- Added `grades:changed` renderer notifications after grade mutations.
- Added idempotent migration `migrations/2026-05-apply-audit-and-indexes.sql`.
- Enabled `PRAGMA foreign_keys = ON`, `journal_mode = WAL`, and `synchronous = NORMAL` at database open.
- Added template validation with structured row/column errors.
- Added Tailwind neumorphism tokens.
- Refactored raw score editing to debounce a batch flush instead of writing on every keystroke.

## Known Repository Constraint

This workspace is not currently a Git repository, so the requested branch and PR split could not be created locally.

## PR Checklist

- [ ] Tests added and passing.
- [ ] Linting and TypeScript checks pass.
- [ ] Preload API documented in `docs/ipc.md` with TypeScript types.
- [ ] Migration script included and tested on a copy of production DB.
- [ ] Demo GIF/video attached showing the change.
- [ ] Security review: confirm no `nodeIntegration` and only whitelisted IPC channels.
