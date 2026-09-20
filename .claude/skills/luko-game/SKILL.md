---
name: luko-game
description: Build and wire an HTML5 mini-game for LUKO — standalone file under public/games, the iframe/postMessage completion contract, and registering it (filename C1-Kr-F1-S1-G1.html for the season path, trafficRules, recipes). Use when asked to create, fix, or hook up a game or interactive lesson.
---

# Making a LUKO game

Games are the core of the product: a child learns by playing, then gets coins and dew.

## Where the file goes
```
frontend/public/games/<grade>/<subject>/<game-name>.html
```
Grades: `grade-1`, `grade-2`, … Subjects: `math`, `science`, `quran`, `writing`, `reading`, …
Must be inside `public/` to be served by URL. Reference:
[public/games/README.md](../../../frontend/public/games/README.md).

## File rules
- **One self-contained HTML file** — CSS and JS inline, no build step, no CDN or external
  asset (the iframe is sandboxed and the app must work offline-ish).
- Persian, RTL (`<html lang="fa" dir="rtl">`), mobile-first, touch targets ≥ 44px.
- **No emoji** — inline SVG only, same stroke style as the app.
- Colors: use the host character's theme (usually `gamer`/پیکسل for book games, or the
  section's own character for traffic/cooking games).
- Keep it winnable by a 7-year-old: short rounds, immediate feedback, no dead ends, no
  text the child must read fast, no scoring that can go negative.
- No external network calls, no localStorage writes outside a `luko_game_<name>_` prefix.

## Completion contract
When the child finishes, tell the parent page:
```js
window.parent.postMessage({ type: 'luko-game-complete' }, window.location.origin);
```
[pages/BookGame.tsx](../../../frontend/src/pages/BookGame.tsx) listens, checks
`e.origin === window.location.origin`, marks the level complete, and grants coins + dew +
fertilizer exactly once (`rewardedRef`). Never send the message more than once per session
and never send it on load — that would hand out free currency.
A manual "این مرحله رو تموم کردم" button is the fallback for games without the message.

## Telemetry — every new game ships it
The product goal is per-child analytics in the parent panel, so a game that only reports
"done" is half-built. Follow the contract in
[public/games/README.md](../../../frontend/public/games/README.md) and the reference
implementation in `_reference/base-game.html`:

- `luko-game-event` on each interaction, `luko-game-complete` once on win,
  `luko-game-progress` on `pagehide` when the child quits mid-way.
- The `answer` event carries `correct / given / expected / ms / attempt / hintUsed / tier`
  — the columns the parent report is built from. Log wrong answers, hints and idle gaps;
  they are the most useful signals, not noise.
- `summary` carries accuracy, avg/median answer time, per-round records, and adaptive
  difficulty tier. Never send names or free text — only numbers and enum-ish strings.
- Test the stream with `?debug=1` (live event panel) before calling the game done.

## Registering the game
Three families of games, three registries:

| Kind | Registry | Route | What to do |
|---|---|---|---|
| Season path game | the **filename** in `public/games/` | `/game/:gameId` | name it `C1-Kr-F1-S2-G2.html`, then `manage.py sync_games` |
| Traffic rule | `features/home/trafficRules.ts` | `/traffic-game/:ruleId` | `hasGame: true` |
| Cooking recipe | `features/home/recipes.ts` | `/cooking-game/:recipeId` | `hasGame: true` |

Season-path games need **no code change**: C=class, K=book (internal only — never shown to
the child), F=chapter/month, S=week, G=game number **within that book**; ordered numerically
C→F→S→G, then book. Dashes are optional (`C1KrF1S2g2.html` is the studio's own style). Run `python manage.py sync_games --check` to see where the file lands and why a
name is rejected. Rules and the book-code table: [public/games/README.md](../../../frontend/public/games/README.md).
Game ids are opaque (`g-1a2b3c4d`) and survive renames; completion is stored server-side
and mirrored in `luko_completed_games`. Keep the `<title>` free of subject words
("ریاضی", "نگارش", …) — it becomes the title the child sees.

For traffic/cooking, `hasGame: false` renders the "به‌زودی" placeholder — that is the
correct state for a not-yet-built game, so leave it rather than shipping a stub.

## After building
1. `preview_start` the frontend and open the game route — play it through to the win state
   and confirm the reward fires once (see [run-and-test](../run-and-test/SKILL.md)).
2. Check the browser console for errors inside the iframe.
3. Verify it looks right at 375px width.
