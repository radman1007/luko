---
name: backend-api
description: LUKO Django + DRF backend conventions — response envelope and camelCase, server-authoritative rewards, admin-editable content, Celery resets, migrations and seed data. Use when adding or changing anything under backend/.
---

# LUKO backend (Django 5 + DRF)

Full map: [backend/README.md](../../../backend/README.md). Stack: Django 5, DRF,
PostgreSQL (JSONB for garden state + analytics events), Redis (cache + Celery broker),
JWT via simplejwt, Celery beat for scheduled resets.

## Non-negotiable wire contract
Every API lives under `/api/v1` and answers `{ "data": … }` on success,
`{ "error": … }` on failure, with **camelCase keys** — produced automatically by
`EnvelopeJSONRenderer` in [apps/common/renderers.py](../../../backend/apps/common/renderers.py).
So: keep serializers Pythonic snake_case and return plain payloads; do not hand-roll the
envelope or camelCase in a view. The frontend (`lib/api.ts`) unwraps `data.data`.

## Apps
| App | Owns |
|---|---|
| `accounts` | User (phone-based), Profile, KidSettings, Lukorian builder, treasures, OTP auth |
| `health` | mood check-ins (30-min prompt), paintings, client-encrypted secrets |
| `club` | MissionTemplate / MissionAssignment, medals, shop, teacher-parent suggestions |
| `garden` | GardenState / Plant / GardenShopItem, seasonal reset |
| `games` | Game, GameCompletion, GameEvent (analytics for later LLM work) |
| `common` | renderer, exceptions, pagination, cache helpers, `seed_luko` command |

Auth is **OTP-based**: `POST /auth/request-otp`, `POST /auth/verify-otp` (creates the
account if new), plus `me` / `refresh` / `logout`. There is no password login.

## Rules that protect the product
1. **Every valuable number is computed and validated server-side** — coins, dew, treasures,
   medals, unlocks. A client request may only say "I finished game X"; the server decides
   the reward. Never accept an amount from the client.
2. **Content is admin-editable.** Missions, sport tasks, medals (count/condition/threshold),
   club shop and garden shop are rows with an admin registration — not constants in code.
   New rewardable content follows the same pattern.
3. **Secrets stay opaque.** `health` stores the client's AES-GCM payload; the server never
   sees plaintext or the child's password. Do not add a decrypt path "for support".
4. **Kids' data is sensitive.** No PII in URLs or logs; uploads (child photo for the custom
   Lukorian) need type/size limits and parental consent.
5. Week starts **Saturday** and rolls over via the `rollover_week` task; the garden resets
   each calendar season (lazy on read + daily `apply_seasonal_resets`). Reuse these tasks
   rather than adding new cron-ish logic.

## Adding an endpoint
1. Model + `makemigrations` (commit the migration file), register in `admin.py` if content.
2. Serializer (snake_case) → view → path in the app's `urls.py`, included from
   [config/urls.py](../../../backend/config/urls.py) under `api_v1`.
3. Extend `seed_luko` if the feature needs default rows to be usable out of the box.
4. Update the API table in `backend/README.md` and the hook↔endpoint map in
   [docs/backend-integration.md](../../../docs/backend-integration.md) in the same change.
5. Verify against the real shape the frontend expects — see [connect-api](../connect-api/SKILL.md).

## Running & checking
```bash
cd backend && docker compose up --build       # web:8000, db, redis, worker, beat
```
```bash
cd backend && USE_SQLITE=1 python manage.py check && USE_SQLITE=1 python manage.py migrate
```
`USE_SQLITE=1` in `.env` gives a quick run without Postgres. There is **no automated test
suite yet** — when you add one, put it in `apps/<app>/tests/`, run it with
`USE_SQLITE=1 python manage.py test`, and update [run-and-test](../run-and-test/SKILL.md).
Never commit `.env`; keep `.env.example` in sync with any new setting.
