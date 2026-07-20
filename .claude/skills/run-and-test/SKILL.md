---
name: run-and-test
description: How to run the LUKO web app locally and execute its tests. Use whenever asked to start the dev server, verify a change works, or run/write tests.
---

# Running & Testing LUKO

## Project layout
- `frontend/` — React + Vite app (TypeScript)
- `backend/` — API server (stack TBD — update this file once chosen)

## Run the frontend
```bash
cd frontend
npm install        # only if node_modules is missing or package.json changed
npm run dev        # starts Vite dev server on http://localhost:5173
```
Prefer the preview tools (`preview_start` via `.claude/launch.json`) over raw Bash when you need to see or interact with the UI.

## Run the backend
> TODO: fill in once the backend stack is chosen (e.g. `cd backend && npm run dev` or `uvicorn main:app --reload`).
The frontend expects the API base URL in `frontend/.env` as `VITE_API_URL`.

## Tests
```bash
cd frontend
npm test           # Vitest, watch mode off in CI: npm test -- --run
```
- Unit tests live next to the code as `*.test.ts(x)`.
- Use Vitest + React Testing Library. Test behavior, not implementation details.
- After any non-trivial change, run the related tests before declaring the work done. Report failures verbatim — never claim success without running them.

## Type & lint checks
```bash
cd frontend
npm run lint
npx tsc --noEmit
```
Run both before finishing a task that touched TypeScript code.
