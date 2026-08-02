---
name: project-docs
description: How LUKO documentation is organized and kept current. Use when writing docs, updating the README, or after a change that affects setup, env vars, endpoints, or architecture.
---

# LUKO Documentation

## Where docs actually live
- [README.md](../../../README.md) — overview, quick start, env vars, brand summary. Keep it
  short and link out for depth.
- [docs/features.md](../../../docs/features.md) — the product spec: every feature the rebuild
  must have, extracted from the old project. **Tick ✅ next to a feature when it ships.**
- [docs/backend-integration.md](../../../docs/backend-integration.md) — the hook ↔ endpoint
  map and the security notes for wiring the frontend to the API. Update the row when a
  hook gets connected.
- [backend/README.md](../../../backend/README.md) — backend stack, how to run it, the API
  table. New or changed endpoints go here.
- [frontend/public/games/README.md](../../../frontend/public/games/README.md) — how game
  files are laid out and registered.

## Rules
- Docs are updated in the same change that makes them stale — setup steps, env vars, an
  endpoint, a route, or architecture.
- Write for a new developer: assume React/TS knowledge, zero LUKO knowledge.
- Persian or English prose is fine; keep commands, file paths, and API names exactly as in
  code. Match the language of the file you're editing.
- Every env var the app reads must appear in the README with a one-line description and in
  the matching `.env.example` (`frontend/.env.example`, `backend/.env.example`).

## When creating a new doc
Extend one of the files above rather than creating a new one, unless it's a genuinely new
topic. If you do add a doc, link it from the README and add it to this list.
