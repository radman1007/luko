---
name: luko-section
description: LUKO brand rules for building any user-facing screen, section, or card — Lukorian host character, per-section color theme, CharacterGuide, no-emoji/SVG-only icons, RTL Persian UI. Use whenever adding or restyling a page, feature section, or home card.
---

# Building a LUKO section

Every user-facing surface in LUKO belongs to the story of the city of **Luko** and its
tribe, the **LUKORIANS**. A screen without a host character and its own theme is not
finished work — the user rejects it.

## 1. Pick the host character
Registry: [frontend/src/lib/characters.ts](../../../frontend/src/lib/characters.ts) —
`LUKORIANS.<key>` gives `{ id, name, role, image, theme: { primary, dark, soft, accent } }`.
Images live in `frontend/public/characters/`.

Current hosts (key → name): `health` دکتر نیلا, `welcome` پری (ورود), `club` توپا,
`art` رنگو, `sport` چابک, `tv` ویدا, `garden` سبزو, `maker` مکانو (پروفایل/تنظیمات),
`explorer` کاشف, `podcast` آوا, `science` دانا (کتاب‌ها), `gamer` پیکسل (گیم‌زون/بازی‌ها),
`traffic` سروان راه, `chef` سرآشپز زعفران, `guard` آهنین (صندوقچه‌ی رازها),
`courier` چاپار, `ranger` بلوط. Read the registry before using a key — it grows.

- Re-use an existing host if the section belongs to their domain.
- A **new** section needs a new Lukorian: ask the user for the character sheet/image
  first, add the entry to the registry, then build. Never ship a section with a
  borrowed character "for now" without saying so.
- Character sheets sometimes carry black separator lines between cells — crop a few
  pixels inward, and flood-fill the checkerboard using a "light gray" threshold.

## 2. Theme it with local CSS variables
Never hard-code a section color. Define the character's palette once on the page root
in the CSS Module and read it everywhere below:

```css
/* Garden.module.css */
.page {
  --garden-primary: #6f9455;
  --garden-dark: #55763f;
  --garden-soft: #eef3e6;
  --garden-accent: #c1663b;
  --nav-accent: var(--garden-primary); /* bottom nav follows the section */
}
```
Global brand tokens (city red #d2003c, yellow #ffcc00, brand teal #215e61, orange
#ff9e20, text #1d2128, bg #f4f2f2) live in `src/styles/globals.css` — take colors from
there or from the character theme, nowhere else.

## 3. Introduce the section with CharacterGuide
```tsx
<CharacterGuide character={LUKORIANS.garden} steps={['...', '...']} storageKey="garden" />
```
Shown once per `storageKey` (`luko_guide_<key>` in localStorage). Write the steps in the
character's own voice — playful, kid-facing Persian, first-person.

## 4. Icons: emoji are forbidden
- **Absolutely no emoji anywhere** — not in JSX, not in data files, not in game HTML.
- Use `react-icons/hi2` (Heroicons Outline) or the project's own stroke icons in
  [components/ui/icons/index.tsx](../../../frontend/src/components/ui/icons/index.tsx).
- New custom icons match the house style: stroke-based, `strokeWidth={1.8}`, round caps,
  `currentColor`, sized by a `size` prop.

## 5. Structure & routing
- Page shell in `src/pages/<Name>.tsx` + `<Name>.module.css`, kept thin.
- Real content in `src/features/<domain>/components/<Component>/` — one folder per
  component with its own CSS Module; data in `<domain>Data.ts`, logic in `use<Domain>.ts`.
- Register the route in [src/router.tsx](../../../frontend/src/router.tsx) as a `lazy()`
  import wrapped in `student(...)` for student pages.
- Bottom nav has 5 slots only ([components/layout/BottomNav](../../../frontend/src/components/layout/BottomNav)) —
  adding a tab means removing one; ask the user before changing it.

## 6. Persian / RTL details
- All UI text in Persian, mobile-first, RTL.
- Numbers shown to kids: `value.toLocaleString('fa-IR')`.
- localStorage keys are prefixed `luko_` (e.g. `luko_coins`, `luko_garden_state`).
- Comments in source may be Persian — match the surrounding file.

## 7. Economy hooks
If the section rewards the child, use the existing currencies rather than inventing one:
coins (`useClub`), dew/شبنم (`features/garden/store.ts` → `grantDew/grantFertilizer/grantSeeds`),
treasures/گنج (`features/profile/useTreasure`). Reward amounts belong in a `config.ts` /
`*Data.ts` constant, never inline. See [connect-api](../connect-api/SKILL.md) — these
values must move server-side once wired to the backend.
