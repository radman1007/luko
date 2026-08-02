# بازی‌های آموزشی لوکو

بازی‌ها فایل‌های HTML مستقل (JS/CSS درون‌خطی) هستند که داخل iframe (با sandbox) در صفحه‌ی
اجرای بازی بارگذاری می‌شوند. برای اینکه از طریق URL سرو شوند، حتماً باید داخل `public/` باشند.

## ساختار پوشه‌ها
```
public/games/<پایه>/<درس>/<نام-بازی>.html
```
مثال: `public/games/grade-1/math/animals-island.html`

پایه‌ها: `grade-1`, `grade-2`, …
درس‌ها: `math`, `science`, `quran`, `writing`, `reading`, …

## افزودن یا اتصال یک بازی
۱. فایل HTML بازی را در پوشه‌ی پایه/درسِ درست بگذارید.
۲. در `src/features/books/booksData.ts`، در مرحله‌ی مربوطه فیلد `file` را برابر نام فایل بگذارید:
   ```ts
   { title: 'اسم مرحله', coinReward: 12, file: 'animals-island.html' }
   ```
   نبودِ `file` یعنی بازی هنوز آماده نیست و در اجرا «به‌زودی» نشان داده می‌شود.

## اتصال پایانِ بازی
اگر بازی خودش پایان را تشخیص می‌دهد، به والد پیام می‌دهد تا مرحله کامل و جایزه ثبت شود:
```js
window.parent.postMessage({ type: 'luko-game-complete' }, window.location.origin);
```
`BookGame` فقط پیام‌های هم‌ریشه را می‌پذیرد و جایزه را **یک بار** می‌دهد.
بازی‌هایی که این پیام را نمی‌فرستند، با دکمه‌ی «این مرحله رو تموم کردم» ثبت می‌شوند.

## قرارداد داده‌ی بازی (تله‌متری)
هدف: فرستادنِ رفتارِ ریزِ بچه به سرور و ساختِ گزارشِ والدین. مرجعِ پیاده‌سازی:
[grade-1/math/number-train.html](grade-1/math/number-train.html).

بازی سه نوع پیام می‌فرستد (همه با `origin` خودمان):

| پیام | کِی | بار |
|---|---|---|
| `luko-game-event` | هر تعامل | `{ game, sessionId, event }` |
| `luko-game-complete` | پایانِ موفق (یک بار) | `{ game, sessionId, summary }` |
| `luko-game-progress` | بستنِ صفحه بدون اتمام (`pagehide`) | `{ game, sessionId, summary }` |

`event.type`های استاندارد: `game_start`، `station_start`، `select`، `swap`، `answer`
(با `correct/given/expected/ms/attempt/hintUsed/tier`)، `hint`، `station_end`، `idle`،
`away`، `setting`، `game_end`.

`summary` شاملِ: `accuracy`، `avgAnswerMs`/`medianAnswerMs`، `errors`، `hints`،
`idlePeriods`، `durationMs`، `device` و آرایه‌ی دورها (هر دور: نوعِ تمرین،
`tier` سختیِ تطبیقی، زمان، خطا، ستاره، و سنجه‌ی مخصوصِ همان بازی مثل
`moves` در برابر `optimalMoves`).

بازی‌هایی که چند مبحث را پوشش می‌دهند (مثل
[grade-6/game_6aval_riyazi.html](grade-6/game_6aval_riyazi.html)) روی هر `answer` یک
`topic` هم می‌گذارند و در `summary.topics` تسلطِ درس‌به‌درس را می‌دهند:
`{ fraction: { label, asked, correct, accuracy, avgMs, hints }, … }` — این دقیقاً
ورودیِ بخشِ «تسلط در درس‌ها» در پنل والدین است.

**مرحله‌ی بعد (هنوز انجام نشده):** در `BookGame` این پیام‌ها بافر و به
`POST /api/v1/games/{slug}/events` فرستاده شوند تا پنل والدین از رویِ همین‌ها ساخته شود.
برای دیدنِ زنده‌ی داده‌ها بازی را با `?debug=1` باز کنید؛ `window.LUKO_GAME.summary()` هم
در کنسول در دسترس است.

## آینده (React)
بازی‌های React بعداً به‌صورت route داخلی یا کامپوننت اضافه می‌شوند؛ فیلد `file` می‌تواند به
یک مسیر داخلی اشاره کند و در `BookGame` منطق تشخیص نوع بازی اضافه شود.
