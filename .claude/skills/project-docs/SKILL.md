---
name: project-docs
description: How project documentation is organized and kept current for LUKO. Use when writing docs, updating the README, or after a change that affects setup, APIs, or architecture.
---

# LUKO Documentation

## Where docs live
- `README.md` — project overview, quick start, how to run locally. Keep it short; link to `docs/` for depth.
- `docs/architecture.md` — high-level system design, frontend/backend boundaries, key decisions
- `docs/api.md` — backend endpoints: method, path, request/response shapes
- `docs/decisions/` — one short ADR file per significant technical decision (`NNN-title.md`: context, decision, consequences)

## Rules
- Docs are updated in the same change that makes them stale — if you change setup steps, env vars, an endpoint, or architecture, update the matching doc before finishing.
- Write for a new developer joining the team: assume they know React/TS but nothing about LUKO.
- Persian or English is fine for prose, but keep code samples, commands, and API names exactly as they are in code.
- Every env var the app reads must be listed in the README with a one-line description and an entry in `.env.example`.

## When creating a new doc
Check this skill's list first — extend an existing file rather than creating a new one unless it's a genuinely new topic.
