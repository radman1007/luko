# معماری بازی‌ها — چرخهٔ عمرِ مشترک

مرجعِ ساختِ هر بازیِ تازه و مهاجرتِ بازی‌های موجود.
همراهِ این سند: [`docs/game-telemetry.md`](game-telemetry.md) که می‌گوید هر
فیلد در تحلیل به چه کار می‌آید.

- پیاده‌سازی: [`frontend/public/games/assets/luko-sdk.js`](../frontend/public/games/assets/luko-sdk.js)
- نمونهٔ اجراشدنی: `/games/_reference/base-game.html` (فقط روی dev server)

---

## ۱) مسئله

هر بازیِ لوکو یک فایلِ HTML مستقل است که منطقِ مرحله‌بندی‌اش را خودش دارد.
۲۷ بازی یعنی ۲۷ اسمِ متفاوت برای یک مفهوم:

| بازی | شمارندهٔ مرحله | سقفِ مرحله |
|---|---|---|
| ۰۱ جزیرهٔ حیوانات | `state.currentLevel` | `MAX_LEVEL = 3` |
| ۰۲ قطار اعداد | `state.level` | `maxLevel: 3` |
| ۱۷ ماهی کوچولو | `state.currentLevel` | `state.totalLevels = 10` |
| ۲۳ کارخانهٔ خوراکی | `GameState.level` | `totalLevels: 30` |
| ۲۵ بسم‌الله | `G.stage` | — |

پلتفرم از هیچ‌کدامِ این‌ها خبر نداشت. تنها چیزی که می‌دید یک پیامِ
«تمام شد» بود. دو نتیجه داشت:

**الف) بازی بعدِ مرحلهٔ اول تمام می‌شد.** `LUKO.finish()` در ۲۱ بازی از ۲۷
داخلِ `levelComplete()` نشسته بود. یعنی مرحلهٔ ۱ که تمام می‌شد، اپ پیامِ
`luko-game-complete` می‌گرفت، سکه می‌داد، مرحلهٔ سیزن را تیک می‌زد و بچه
را به نقشه برمی‌گرداند. مرحله‌های ۲ تا ۳۰ هیچ‌وقت بازی نمی‌شدند.

بازیِ ۰۱ حتی خودش می‌دانست مرحلهٔ آخر کدام است:

```js
function levelComplete() {
  LUKO.finish({ level: state.currentLevel, ... });   // ← قبل از چک
  let isFinalLevel = state.currentLevel >= MAX_LEVEL; // ← چکِ درست، دیر
}
```

**ب) پنل والدین هیچ دیدی به سطحِ مرحله نداشت.** نه زمانِ مرحله، نه خطای
مرحله، نه اینکه بچه روی کدام مرحله گیر کرده. `LUKO.stage()` و
`LUKO.hint()` در SDK بودند ولی **هیچ بازی‌ای صدایشان نمی‌زد** — یعنی
شمارندهٔ راهنمای گزارش همیشه صفر بود، و چون معیارِ «تسلط» در
`apps/parent/services.py` این است:

```python
elif accuracy >= 85 and bucket["hints"] == 0:
    status = "mastered"
```

شرطِ دومش همیشه برقرار بود و «تسلط» عملاً فقط به دقت وابسته می‌شد.

---

## ۲) دو مفهومِ «مرحله» که نباید قاطی شوند

لوکو دو سطحِ مرحله دارد و تا امروز فقط یکی‌شان اسم داشت:

```
مرحلهٔ سیزن (Season Stage)  ← یک فایلِ بازی؛ سرور می‌شناسدش
   └── مرحلهٔ داخلی (Level) ← ۳ تا ۳۰ تا؛ تا امروز نامرئی بود
```

- **مرحلهٔ سیزن** = یک ردیف در `games_game` با `season_order`. تمام‌شدنش
  یک `GameCompletion` می‌سازد و سکه می‌دهد. قفلِ پشتِ‌سرهمِ نقشه روی
  همین است.
- **مرحلهٔ داخلی** = مرحله‌های خودِ بازی. نه سکه دارد، نه قفلِ سیزن؛ ولی
  واحدِ واقعیِ «یادگیری» است و گزارشِ والدین بدونش کور است.

**قانون:** `luko-game-complete` فقط و فقط وقتی می‌رود که *همهٔ* مرحله‌های
داخلی تمام شده باشند. هیچ‌وقت با `levelCompleted = true` تنها.

---

## ۳) ماشینِ حالت

```
CREATED ──init()──▶ READY ──startGame()──▶ PLAYING ⇄ PAUSED
                                             │        pause()/resume()
                                  startLevel()│
                                             ▼
                                        (مرحله در جریان)
                                             │
                              levelComplete()│levelFailed()
                                             ▼
                                       LEVEL_ENDED
                                       ╱          ╲
                       مرحلهٔ دیگری مانده        آخرین مرحله بود
                              │                        │
                              ▼                        ▼
                          PLAYING                 COMPLETED
                                                       │
                                                       ▼
                                              results_finalized
                                                       │
                                                       ▼
                                            luko-game-complete
```

مسیرهای فرعی:

```
PLAYING / LEVEL_ENDED ──gameOver()──▶ GAME_OVER   ──▶ luko-game-progress
هر حالتِ غیرِپایانی   ──abandon()───▶ ABANDONED   ──▶ luko-game-progress
```

| سؤال | پاسخ در معماری |
|---|---|
| کِی بازی واقعاً شروع شده؟ | `startGame()` — نه بارگذاریِ فایل. وقتِ منو دیگر جزوِ وقتِ بازی نیست. |
| کِی مرحله شروع شده؟ | `startLevel(n)` — ساعتِ مرحله همان‌جا صفر می‌شود. |
| کِی مرحله تمام شده؟ | `levelComplete()` یا `levelFailed()` — هر دو فقط مرحله را می‌بندند. |
| کِی کلِ بازی تمام شده؟ | وقتی `currentLevel === totalLevels` **و** آن مرحله برده شده. تنها جایی که این تصمیم گرفته می‌شود `hasMoreLevels()` است. |
| کِی نتیجه محاسبه می‌شود؟ | `finalize()` — یک‌بار، بلافاصله بعدِ رسیدن به حالتِ پایانی. |
| کِی داده ارسال می‌شود؟ | رویدادها در لحظه (اپ دسته‌ای می‌فرستد)؛ خلاصه در `finalize()`. |
| کِی برگشت به منو مجاز است؟ | بعد از `results_finalized`. زودتر یعنی از دست رفتنِ داده. |

گذارِ غیرمجاز **بی‌صدا رد می‌شود** و رویدادِ `state_rejected` ثبت می‌کند.
دلیلش این است که یک صدازدنِ اشتباه در یکی از ۲۷ بازی نباید کلِ جلسه را
خراب کند — ولی باید در تحلیل دیده شود.

---

## ۴) API

```js
LUKO.init({ gameId, gameType, totalLevels })   // معرفی → READY
LUKO.startGame()                               // منو → بازی
LUKO.startLevel(index, { id, title })          // شروعِ مرحله
LUKO.answer({ topic, topicLabel, correct, ms, attempt, hintUsed, given, expected })
LUKO.hint(topic)
LUKO.mistake({ ... })                          // خطای غیرِپاسخ
LUKO.addScore(points)
LUKO.levelComplete({ score })                  // ← جای finish در بازیِ چندمرحله‌ای
LUKO.levelFailed({ reason })
LUKO.pause(reason) / LUKO.resume()
LUKO.gameOver({ reason })                      // باختِ قطعی — بدونِ جایزه
LUKO.abandon(reason)
LUKO.finish(extra)                             // پایانِ بازی (نگهبانی‌شده)
LUKO.snapshot()                                // مدلِ دادهٔ فعلی
LUKO.on(fn)                                    // اشتراک برای UI
```

### نگهبانِ `finish`

```js
if (S.declared && hasMoreLevels() && S.currentLevel > 0) {
  emit('finish_deferred', { level, totalLevels });
  return LUKO.levelComplete(extra);
}
```

بازی‌ای که `init({ totalLevels })` را صدا زده باشد، دیگر نمی‌تواند وسطِ
راه بازی را تمام کند — حتی اگر `finish()` را در `levelComplete` جا
گذاشته باشیم. یعنی **مهاجرتِ هر بازی با یک خط (`init`) امن می‌شود**،
حتی قبل از اینکه محلِ `finish` را عوض کنیم.

### سازگاریِ عقب‌رو

بازی‌ای که `init()` را صدا نزند دقیقاً مثلِ قبل کار می‌کند: `finish()`
یعنی پایانِ بازی، `answer()` و `hint()` مثلِ سابق. هر ۲۷ بازیِ فعلی
بدونِ یک خط تغییر روی SDK جدید تست شده‌اند.

---

## ۵) مدلِ داده

```jsonc
{
  "schema": 2,
  "sessionId": "s1abc2def",     // یکتا برای هر بار بازکردنِ بازی
  "gameId": "math-1-1",
  "gameSlug": "01-riyazi_f1_g1",
  "gameType": "sorting",
  "status": "COMPLETED",

  "totalLevels": 3,
  "currentLevel": 3,
  "levelsCompleted": 3,
  "progress": 100,              // درصد

  "startedAt": "2026-09-06T08:14:02.100Z",
  "endedAt":   "2026-09-06T08:19:41.880Z",
  "durationMs": 339780,         // از شروع تا پایان
  "activeMs":   301200,         // بدونِ مکث ← معیارِ «چقدر واقعاً بازی کرد»

  "score": 90,
  "asked": 24, "correct": 19, "errors": 5,
  "mistakes": 2,                // خطای غیرِپاسخ
  "attempts": 27, "hints": 3,
  "accuracy": 79,
  "avgAnswerMs": 3400, "medianAnswerMs": 2900,
  "idlePeriods": 1,

  "levels": [
    { "index": 1, "id": "lvl-1", "title": "مرحلهٔ ۱",
      "startedAt": "...", "endedAt": "...", "durationMs": 94200,
      "status": "passed",       // passed | failed | abandoned | interrupted | playing
      "score": 30, "asked": 8, "correct": 7, "mistakes": 0,
      "attempts": 9, "hints": 1, "accuracy": 88, "avgAnswerMs": 3100 }
  ],

  "topics": {
    "count": { "label": "شمارش", "asked": 12, "correct": 10,
               "accuracy": 83, "avgMs": 3200, "hints": 1 }
  },

  "device": "mobile"
}
```

### چه چیزی عمداً **نیست**

| فیلد | چرا نه |
|---|---|
| `playerId` / `childId` | سرور از توکن می‌خواندش. فرستادن از سمتِ بازی یعنی هر کسی می‌تواند به‌جای دیگری امتیاز بفرستد. |
| `events: []` داخلِ مدل | رویدادها جریانِ جداگانه دارند. تکرارشان در خلاصه، بارِ شبکه را چند برابر می‌کند بی‌آنکه چیزی اضافه کند. |
| `coins` / `stars` | پاداش سمتِ سرور صادر می‌شود (`apps/games/services.complete_game`). عددِ سمتِ بازی فقط نمایشی است. |
| `levelConfig` / چیدمانِ صفحه | دادهٔ رفتاری نیست؛ در تحلیل به کار نمی‌آید. |

### `mistakes` در برابر `errors`

`errors = asked - correct` (پاسخِ غلط) و `mistakes` فقط خطای غیرِپاسخ
است — تیله افتاد، وقت تمام شد، مسیرِ غلط رفت. اگر پاسخِ غلط را در هر دو
بشماریم، عددِ «خطا» در گزارشِ والدین دو برابر دیده می‌شود.

---

## ۶) رویدادها

هر رویداد **همیشه** این‌ها را دارد: `type`, `at`, `status`, `level`,
`levelId`, `score`. رویدادِ بی‌زمینه بعداً قابلِ تحلیل نیست.

| رویداد | کِی | بارِ اختصاصی |
|---|---|---|
| `game_loaded` | فایل بار شد | `at` |
| `game_ready` | `init()` | `gameType`, `totalLevels` |
| `game_start` | `startGame()` یا اولین تعاملِ بازیِ قدیمی | `at`, `legacy?` |
| `level_start` | `startLevel()` | `index`, `id`, `title` |
| `answer` | هر پاسخ | `topic`, `correct`, `ms`, `attempt`, `hintUsed`, `tier`, `given`, `expected` |
| `hint` | `hint()` | `topic` |
| `mistake` | `mistake()` | هرچه بازی بدهد |
| `level_end` | پایانِ مرحله | `index`, `result`, `durationMs`, `levelScore`, `asked`, `correct`, `mistakes`, `hints` |
| `pause` / `resume` | مکث | `reason` |
| `idle` | بیش از ۳۰ ثانیه بی‌حرکتی | `ms` |
| `game_over` | باختِ قطعی | `reason` |
| `game_abandoned` | ترکِ بازی | `reason` |
| `results_finalized` | محاسبهٔ نتیجه | `result`, `durationMs`, `score` |
| `finish_deferred` | `finish` وسطِ بازی مهار شد | `level`, `totalLevels` |
| `state_rejected` | گذارِ غیرمجاز | `from`, `to`, `reason` |
| `guide_shown` | راهنمای خودکار باز شد | — |

`game_start` عمداً به **اولین تعامل** گره خورده، نه به بارگذاری: قبلاً هر
بار بازکردن و بستنِ فوریِ بازی هم یک «شروع» شمرده می‌شد.

---

## ۷) قرارداد API

**هیچ endpointِ تازه‌ای لازم نیست.** ساختارِ فعلی جواب می‌دهد و عوض‌کردنش
یعنی شکستنِ چیزی که کار می‌کند:

| Endpoint | Method | بدنه | پاسخ | خطا |
|---|---|---|---|---|
| `/api/v1/games/events` | POST | آرایه‌ای از `{ gameSlug, eventType, payload }` | `204` | شبکه قطع → رویداد دور ریخته می‌شود؛ بازی گیر نمی‌کند |
| `/api/v1/games/<slug>/complete` | POST | — | `{ alreadyDone, coins, dew, fertilizer, treasures }` | `403` مرحلهٔ سیزن هنوز باز نشده |
| `/api/v1/games/completed` | GET | — | `{ completed: [slug] }` | `401` |
| `/api/v1/games/<slug>/play-link` | GET | — | `{ url }` | `401` مهمان · `403` قفل |

مسیرِ داده:

```
بازی (iframe) ──postMessage──▶ BookGame.tsx ──HTTP──▶ games_gameevent ──▶ پنل والدین
   LUKO SDK                     telemetry.ts        (۲۵تایی یا هر ۵ ثانیه)
```

`durationMs` و `activeMs` و `levels[]` همه داخلِ `payload`ِ رویدادهای
`level_end` و `game_complete` می‌روند — `payload` از نوع JSONB است و
مهاجرتِ دیتابیس نمی‌خواهد.

### تغییرِ لازم در بک‌اند

یک تغییر، در [`apps/parent/services.py`](../backend/apps/parent/services.py)
تابعِ `_games()`، که الان فقط این‌ها را می‌شناسد:

```python
if event.event_type == "game_start":   ...
elif event.event_type == "answer":     ...
elif event.event_type == "hint":       ...
elif event.event_type in {"game_end", "game_complete"}: ...
```

باید `level_end` را هم بشناسد تا پنل بتواند «مرحلهٔ ۳ از ۱۰، ۴۲ ثانیه، ۲
خطا» نشان دهد:

```python
elif event.event_type == "level_end":
    bucket["levelsPlayed"] += 1
    if payload.get("result") == "passed":
        bucket["levelsPassed"] += 1
    bucket["levelMs"] += payload.get("durationMs", 0)
    bucket["deepestLevel"] = max(bucket["deepestLevel"], payload.get("index", 0))
```

تا وقتی این اضافه نشود، رویدادها ذخیره می‌شوند ولی در گزارش دیده
نمی‌شوند — چیزی نمی‌شکند، فقط هنوز استفاده نمی‌شود.

---

## ۸) لبه‌ها

| وضعیت | رفتار |
|---|---|
| مکث (`pause`) | ساعتِ بازی و ساعتِ مرحله هر دو می‌ایستند. `activeMs` رشد نمی‌کند، `durationMs` می‌کند. |
| رفتن به تبِ دیگر | خودکار `pause` + ارسالِ `luko-game-progress`. برگشت → `resume`. |
| بستنِ صفحه | `pagehide` → `luko-game-progress` با `abandoned: true`. اپ با `fetch keepalive` می‌فرستد. |
| رفرش | جلسهٔ تازه با `sessionId` تازه. پیشرفتِ داخلیِ بازی از `localStorage` خودش برمی‌گردد؛ جلسهٔ قبلی به‌عنوان رهاشده ثبت مانده. |
| بازی کامل نشد | حالتِ `ABANDONED`. رویدادها هست، `luko-game-complete` نیست ← سکه‌ای هم نیست. |
| خطای جاوااسکریپت | جلسه در آخرین حالتش می‌ماند؛ `pagehide` باز هم داده را می‌فرستد. `post()` داخلِ try/catch است تا تله‌متری هیچ‌وقت بازی را نشکند. |
| مهمان | `telemetry.ts` رویدادها را دور می‌ریزد (کاربرِ بی‌حساب). |
| `finish` دوباره | `TERMINAL` جلویش را می‌گیرد؛ `luko-game-complete` یک‌بار بیشتر نمی‌رود. |

---

## ۹) مهاجرتِ بازی‌های موجود

اولویت با بازی‌هایی است که مرحله‌های بیشتری از دست می‌دهند.

### الگوی مهاجرت — سه خط

```js
// ۱) اولِ اسکریپتِ بازی
LUKO.init({ gameType: 'sorting', totalLevels: MAX_LEVEL });

// ۲) هرجا مرحله ساخته می‌شود (buildLevel / startLevel / loadLevel)
LUKO.startLevel(state.currentLevel, { title: cfg.title });

// ۳) در levelComplete: finish → levelComplete
- LUKO.finish({ level: state.currentLevel, seconds: state.timerSeconds });
+ LUKO.levelComplete({ score: stars * 10 });
```

گامِ ۱ به‌تنهایی باگ را می‌بندد (نگهبانِ `finish`). گام‌های ۲ و ۳ دادهٔ
مرحله‌ای را باز می‌کنند.

### فهرست

| # | بازی | نوع | مرحله | شمارنده | جای فعلیِ `finish` | کار |
|---|---|---|---|---|---|---|
| ۰۱ | جزیرهٔ حیوانات | تطبیق | ۳ | `state.currentLevel` / `MAX_LEVEL` | `levelComplete()` | هر سه گام |
| ۰۲ | قطار اعداد | ترتیب | ۳ | `state.level` / `maxLevel` | پاسخِ درست | هر سه گام |
| ۰۳ | شمارش | شمارش | چند | `currentLevel` | `levelComplete()` — با اینکه `finishGame()` دارد | هر سه گام |
| ۰۴ | هیولاهای گرسنه | مقایسه | چند | `state.level` | `setTimeout` کنارِ «مرحله بعد» | هر سه گام |
| ۰۵ | آزمایشگاه غذا | دسته‌بندی | ۳۰ | `currentLevel` / `levels[]` | پایانِ مرحله | هر سه گام |
| ۰۶ | سفر ریتم | الگو | چند | `currentLevel` | `showLevelComplete()` | هر سه گام |
| ۰۷ | خرگوش مهربان | مسیریابی | ۱ | `currentLevel` | `celebrateWin()` | فقط گام ۱ |
| ۰۸ | آموزش اعداد | نوشتن | چند | `currentLevel` | `gameComplete()` ✔ | گام ۱ و ۲ |
| ۰۹ | بازی اعداد | شناخت | چند | `gameState.level` | `completeGame()` ✔ | گام ۱ و ۲ |
| ۱۰ | سفر ریاضی | محاسبه | ۱ | — | `endGame()` ✔ | فقط گام ۱ |
| ۱۱ | جدول شگفت‌انگیز | منطق | چند | `state.level` | پرشدنِ جدول | هر سه گام |
| ۱۲ | چوب‌کبریت | شمارش | چند | `state.level` | پایانِ چیدمان — با اینکه `finishGame()` دارد | هر سه گام |
| ۱۳ | جدول ۲ | منطق | ۲۰ | `state.currentLevel` / `LEVELS[]` | `checkSolution()` | هر سه گام |
| ۱۴ | مزرعهٔ ریاضی | جمع | چند | `STATE.currentLevel` | wrapper روی `completeLevel` | هر سه گام |
| ۱۵ | ماجراجویی تفریق | تفریق | ۵ | `state.currentLevel` / `levels[]` | `showActionOverlay('complete')` | هر سه گام |
| ۱۶ | بالون‌ها | تعادل | چند | `G.stage` | `checkGameEnd()` ✔ | گام ۱ و ۲ |
| ۱۷ | ماهی کوچولو | مقایسه | ۱۰ | `state.currentLevel` / `totalLevels` | wrapper روی `completeLevel` | هر سه گام |
| ۱۸ | کارخانهٔ خط‌ها | تشخیص | ۳۰ | `currentLevel` / `maxLevel` | `checkGameEnd()` ✔ | گام ۱ و ۲ |
| ۱۹ | نقاش کوچولو | خط‌کشیدن | ۳۰ | `LEVELS[]` | `showLevelCompleteWithReward()` | هر سه گام |
| ۲۰ | خط خمیده | خط‌کشیدن | ۱۰ | `state.game.level` / `LEVELS[]` | `completeLevel()` | هر سه گام |
| ۲۱ | قطار نگارش | نوشتن | ۶ | `levels[]` | wrapper روی `completeLevel` | هر سه گام |
| ۲۲ | ماجراهای حروف | حرف‌شناسی | ۲۰ | `state.currentLevel` / `totalLevels` | `levelComplete()` | هر سه گام + گزارشِ پاسخِ واقعی |
| ۲۳ | کارخانهٔ خوراکی | دسته‌بندی | ۳۰ | `GameState.level` / `totalLevels` | `endLevel(isWin)` | هر سه گام |
| ۲۴ | نعمت‌یاب | یافتن | ۱۲ | `currentLevel` / `totalLevels` | `endGame(win)` | هر سه گام |
| ۲۵ | بسم‌الله | خواندن | چند | `G.stage` | `endGame(win)` | هر سه گام |
| ۲۶ | سلام و علیکم | شنیدن | چند | `currentLevel` | wrapper روی `completeLevel` | هر سه گام |
| ۲۷ | نقاشیِ بسم‌الله | نقاشی | ۱ | — | `finishGame()` ✔ | فقط گام ۱ + گزارشِ پاسخِ واقعی |

✔ = `finish` از قبل در جای درست است.

### یک مشکلِ جدا: دقتِ همیشه ۱۰۰٪

بازی‌های **۱۲، ۲۱، ۲۲، ۲۷** پاسخ را با `correct: true` ثابت گزارش
می‌کنند:

```js
LUKO.answer({ topic: 'letter', correct: true, ... });   // همیشه درست
```

یعنی دقتشان در پنل والدین همیشه ۱۰۰٪ است و طبقِ معیارِ `mastered` همیشه
«مسلط» دیده می‌شوند. این مستقل از چرخهٔ عمر است و باید در خودِ بازی
اصلاح شود: `correct` باید نتیجهٔ واقعیِ همان تلاش باشد.

---

## ۱۰) بازیِ تازه

```html
<script src="/games/assets/luko-sdk.js"></script>
<script>
  const LEVELS = [ /* ... */ ];

  LUKO.init({ gameType: 'matching', totalLevels: LEVELS.length });

  function onPlayPressed() {
    LUKO.startGame();
    startLevel(1);
  }

  function startLevel(n) {
    LUKO.startLevel(n, { id: LEVELS[n - 1].id, title: LEVELS[n - 1].title });
    render(LEVELS[n - 1]);
  }

  function onAnswer(given, expected) {
    const correct = given === expected;
    LUKO.answer({ topic: 'match', topicLabel: 'تطبیق', correct, given, expected });
    if (!correct) return;
    if (allDone()) LUKO.levelComplete({ score: stars() * 10 });
  }

  // مرحلهٔ بعد: SDK خودش می‌داند آخری بوده یا نه
  function onNextPressed() {
    const s = LUKO.snapshot();
    if (s.status === 'COMPLETED') return backToMenu();
    startLevel(s.currentLevel + 1);
  }
</script>
```

بازی هیچ‌جا نمی‌گوید «تمام شد». فقط می‌گوید «این مرحله تمام شد» و
`snapshot().status` را می‌خواند. تصمیمِ پایانِ بازی یک‌جاست: داخلِ SDK.
