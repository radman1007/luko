---
name: code-standards
description: LUKO coding conventions for React + TypeScript — file structure, naming, component patterns, state management, styling. Use when writing or reviewing any project code.
---

# LUKO Code Standards

## Language & tooling
- TypeScript everywhere, `strict: true`. No `any` unless unavoidable — then add a one-line justification comment.
- Formatting is Prettier's job; linting is ESLint's. Never hand-format against them.

## Frontend structure (`frontend/src/`)
```
src/
  components/     # reusable UI components (one folder per component)
  features/       # feature modules: components + hooks + api co-located per feature
  hooks/          # shared custom hooks (use-*.ts)
  lib/            # utilities, api client, constants
  pages/          # route-level components
  types/          # shared TypeScript types
```

## Naming
- Components: `PascalCase` files and exports (`UserCard.tsx`)
- Hooks: `useCamelCase` (`useAuth.ts`)
- Everything else: `camelCase` for values/functions, `kebab-case` for non-component files
- Types/interfaces: `PascalCase`, no `I` prefix

## Component rules
- Function components only, props typed with an explicit `interface Props`.
- Keep components under ~150 lines; extract hooks/subcomponents past that.
- No business logic in components — put it in hooks or `lib/`.
- Derive state where possible; add `useState`/`useEffect` only when there is no simpler option.

## API calls
- All HTTP goes through a single client in `lib/api.ts` — no raw `fetch` scattered in components.
- Server state via TanStack Query (queries/mutations in the feature's `api.ts`).

## Git
- Small, focused commits with imperative messages ("Add login form validation").
- Never commit `.env`, `node_modules`, or `dist`.
