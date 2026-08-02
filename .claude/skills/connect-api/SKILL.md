---
name: connect-api
description: Migrate a LUKO frontend feature from localStorage/mock data to the real backend — hook-by-hook, with TanStack Query, guest mode and offline fallback intact. Use when wiring any feature to the API or debugging a frontend↔backend mismatch.
---

# Wiring a feature to the backend

This is the project's current phase: the backend exists, the frontend still reads
localStorage. Map of every hook → endpoint:
[docs/backend-integration.md](../../../docs/backend-integration.md).

## The one rule that makes this cheap
All reads/writes already happen **inside hooks and stores** — no component touches
localStorage or HTTP directly, and `lib/api.ts` is the only HTTP client. So migrating a
feature means replacing the body of one hook/store. **If a component changes, you took a
wrong turn** (except for new loading/error states).

## Procedure, one feature at a time
1. Read the hook and its localStorage keys, then find the endpoint in
   `backend/README.md`. If the shapes disagree, fix the **backend** to match what the UI
   needs, or change both together — don't add a translation layer in the component.
2. Put the request functions in `features/<domain>/api.ts`, calling `apiClient` and
   returning `data.data` (the envelope is unwrapped there, not in components).
   Model it on [features/auth/api.ts](../../../frontend/src/features/auth/api.ts).
3. Convert the hook to `useQuery` / `useMutation`. Invalidate the queries the mutation
   affects (e.g. completing a mission invalidates club summary *and* garden dew).
4. Keep the external hook API identical (same returned names and functions) so
   components compile untouched.
5. Delete the localStorage read/write — but see guest mode below.
6. Verify with the real backend running (`docker compose up` in `backend/`, frontend dev
   server proxies `/api` → `localhost:8000`). Check the Network tab and console.

## Things that will bite
- **Server owns the numbers.** Coins, dew, treasures and unlocks come from the response;
  stop granting them locally (`grantDew`, `markLevelCompleted`, `useClub` mutations).
  Optimistic UI is fine — the server value always wins on settle.
- **Guest mode stays.** `luko_guest` users have no token; guest paths must keep working
  from localStorage. Branch inside the hook, not in the component.
- **Migrate existing local data** where a child would otherwise lose progress, or accept
  the loss deliberately and say so.
- **Auth is OTP.** `requestOtp` → `verifyOtp` (creates the account if new) → token in
  `luko_access_token`. `api.ts` clears the token and redirects to `/login` on 401; the
  refresh-token flow is still a TODO there — implement it before relying on long sessions.
- **Secrets** (`useSecrets`) send the AES-GCM ciphertext only. Never send the password or
  plaintext, and don't "simplify" the crypto in `lib/crypto.ts`.
- **External stores** (`features/garden/store.ts`, `useSyncExternalStore`) are read by many
  screens. Keep the store as the single subscriber-facing surface and let it own the
  fetching, rather than scattering queries across the components that use it.

## Done means
Endpoint called, UI unchanged in structure, guest mode still works, `npm run lint` and
`npx tsc -b --noEmit` clean, and the row in `docs/backend-integration.md` updated to say
the hook is connected.
