---
name: deploy
description: Build and deploy the LUKO web app. Use when asked to build for production, deploy, release, or prepare artifacts for hosting.
---

# Deploying LUKO

## Production build (frontend)
```bash
cd frontend
npm run build      # outputs to frontend/dist
npm run preview    # serve the production build locally to sanity-check it
```

## Pre-deploy checklist
Before any deploy, all of these must pass — stop and report if any fail:
1. `npm run lint` and `npx tsc --noEmit` are clean
2. `npm test -- --run` passes
3. `npm run build` succeeds with no warnings that indicate broken chunks
4. No secrets committed: `.env` files must be gitignored; only `VITE_`-prefixed vars are safe to expose to the client

## Deploy targets
> TODO: not yet decided. Candidates:
> - Frontend: Vercel / Netlify / Cloudflare Pages (static `dist/` output)
> - Backend: Railway / Render / Fly.io / VPS
> Once chosen, replace this section with the exact deploy command(s).

## Rules
- Never deploy from a dirty working tree; commit first.
- Deploying is outward-facing: confirm with the user before running any deploy command unless they explicitly asked for the deploy in this session.
- After deploy, verify the live URL responds before reporting done.
