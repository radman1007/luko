---
name: run-and-test
description: How to run the LUKO frontend and backend locally and verify a change. Use whenever asked to start the dev server, verify something works, or run checks.
---

# Running & Verifying LUKO

## Project layout
- `frontend/` — React 19 + Vite + TypeScript (strict)
- `backend/` — Django 5 + DRF + PostgreSQL + Redis + Celery

## Run the frontend
```bash
cd frontend && npm install && npm run dev    # http://localhost:5173
```
Prefer the preview tools (`preview_start` with the `frontend` config in
`.claude/launch.json`) over raw Bash whenever you need to see or click the UI — then
`read_page`, `read_console_messages` and a screenshot to prove the change works.
Never ask the user to check manually.

## Run the backend
```bash
cd backend && docker compose up --build      # api on :8000, plus db, redis, worker, beat
```
Without Docker: `USE_SQLITE=1 python manage.py migrate && USE_SQLITE=1 python manage.py runserver 8000`
(then `python manage.py seed_luko` for default missions/medals/shop rows).
The Vite dev server proxies `/api` → `localhost:8000`; `VITE_API_URL` defaults to `/api/v1`.

## Checks to run before declaring a task done
```bash
cd frontend && npm run lint && npx tsc -b --noEmit
```
```bash
cd backend && USE_SQLITE=1 python manage.py check
```

## Tests — read this before claiming tests pass
**There is currently no test runner on either side.** `npm test` does not exist in
`frontend/package.json`, and there are no test files under `backend/apps/`. Do not claim
tests ran or passed; verify behavior by exercising the app in the preview browser and
report what you actually saw.

If you add testing, do it deliberately and update this file:
- Frontend: Vitest + React Testing Library, `*.test.ts(x)` next to the code, test behavior
  not implementation, add a `test` script to `package.json`.
- Backend: `apps/<app>/tests/`, run with `USE_SQLITE=1 python manage.py test`.

Report failures verbatim. Never report success for a step you skipped.
