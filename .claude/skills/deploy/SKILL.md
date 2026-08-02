---
name: deploy
description: Build and deploy the LUKO web app. Use when asked to build for production, deploy, release, or prepare artifacts for hosting.
---

# Deploying LUKO

## Production build (frontend)
```bash
cd frontend && npm run build      # tsc -b && vite build → frontend/dist
```
```bash
cd frontend && npm run preview    # serve the build locally to sanity-check it
```

## Pre-deploy checklist
All of these must pass — stop and report if any fail:
1. `npm run lint` and `npx tsc -b --noEmit` are clean
2. `npm run build` succeeds with no broken-chunk warnings
3. Working tree is committed (never deploy from a dirty tree)
4. No secrets committed: `.env` is gitignored on both sides; only `VITE_`-prefixed vars
   reach the client — never put an API secret behind a `VITE_` name

(There is no test suite yet — see [run-and-test](../run-and-test/SKILL.md); don't fake that step.)

## Targets
**Frontend — Netlify** (current): configured by [netlify.toml](../../../netlify.toml) at the
repo root — `base = frontend`, build `npm run build`, publish `dist`, SPA redirect to
`index.html`. Deploys follow pushes to `main` on `github.com/radman1007/luko`.

> **Netlify is blocked from inside Iran.** For the actual Iranian audience the app needs
> Iranian hosting (Liara / ArvanCloud). Raise this before treating a Netlify deploy as
> "shipped to users" — today it is a preview target, not the production one.

**Backend — not deployed yet.** It runs from [backend/docker-compose.yml](../../../backend/docker-compose.yml)
(web + Postgres + Redis + Celery worker + beat). A real deploy needs managed Postgres and
Redis, `DEBUG=0`, a real `SECRET_KEY` and `ALLOWED_HOSTS`, HTTPS, static files, and the
worker + beat processes running. Point `VITE_API_URL` at the deployed API origin.

## Rules
- Deploying is outward-facing: confirm with the user before running any deploy command
  unless they asked for the deploy in this session.
- After deploy, load the live URL and verify it responds before reporting done.
