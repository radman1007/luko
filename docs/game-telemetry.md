# دادهٔ بازی‌ها — چه چیزی ثبت می‌شود و کجا می‌رود

> **قراردادِ فعلی نسخه‌ی ۳ است** — راهنمای ساده و قدم‌به‌قدمِ تیم‌ها، شکلِ JSON و توضیحِ همه‌ی متغیرها:
> [`event-tracking-guide.md`](event-tracking-guide.md). از نسخه‌ی ۳ هر رویداد ستون‌های جدا دارد
> (`concept_tag`، `is_correct`، `time_taken_ms`، `attempt_number`، `error_type`، `session_id`، `occurred_at`، …) و
> `topic`/`correct`/`ms`/`attempt` همان‌ها با نامِ قدیمی‌اند؛ رویدادهای قبلی با مهاجرتِ `games.0012` به ستون‌ها
> منتقل شده‌اند. باقیِ این سند، معنای خلاصه‌ی جلسه و هر فیلد را برای تحلیل نگه می‌دارد.

این سند مرجعِ تحلیل است: هر عددی که LLM قرار است رویش کار کند، از یکی از
فیلدهای همین‌جا می‌آید.

## مسیرِ داده

```
بازی (iframe)  ──postMessage──▶  اپ (BookGame)  ──HTTP──▶  بک‌اند  ──▶  پنل والدین
   LUKO SDK                        telemetry.ts          GameEvent        گزارش
```

- SDK داخلِ بازی: [`public/games/assets/luko-sdk.js`](../frontend/public/games/assets/luko-sdk.js)
- پلِ اپ: [`features/games/telemetry.ts`](../frontend/src/features/games/telemetry.ts)
  — هر ۲۵ رویداد یا هر ۵ ثانیه دسته‌ای می‌فرستد، و موقعِ بستنِ صفحه با `fetch keepalive`
- ذخیره: `POST /api/v1/games/events` → جدولِ `games_gameevent`
  (`user`, `game_slug`, `event_type`, `payload` از نوع JSON، `created_at`)

> رویدادها **در حالتِ مهمان ارسال نمی‌شوند** (کاربر بی‌حساب، دادهٔ بی‌صاحب).

---

## ۱) رویدادها (`event_type`)

هر ردیفِ `GameEvent` یک رویداد است. `payload` بسته به نوع فرق می‌کند.

### `game_start`
شروعِ هر جلسه. `{ at: "2026-08-27T10:12:00.000Z" }`

### `answer` — **مهم‌ترین رویداد**
هر تصمیمِ درست/غلطِ بچه. پایهٔ «دقت»، «نقطهٔ قوت و ضعف» و «تسلط در درس‌ها».

| فیلد | نوع | معنی |
|---|---|---|
| `topic` | string | کلیدِ مبحث (فهرست پایین) |
| `correct` | bool | درست بود یا نه |
| `ms` | int | زمانِ فکرکردن تا پاسخ، میلی‌ثانیه |
| `attempt` | int | چندمین تلاش روی همین سؤال |
| `hintUsed` | bool | قبلش راهنمایی گرفته بود؟ |
| `tier` | int | مرحله/سختی هنگامِ پاسخ |
| `given` | any | چیزی که بچه انتخاب کرد |
| `expected` | any | پاسخِ درست |

### `hint`
`{ topic }` — بچه راهنمایی خواست. نشانهٔ «مفهوم را کامل نگرفته»، نه بی‌دقتی.

### `station_start`
`{ name, index }` — شروعِ یک مرحله/ایستگاه در بازی‌های چندمرحله‌ای.

### `idle`
`{ ms }` — بیش از ۳۰ ثانیه بی‌حرکتی. برای تشخیصِ خستگی/حواس‌پرتی.

### `game_complete`
پایانِ موفق، **یک‌بار در هر جلسه**. `payload` همان `summary` است (پایین).

### `game_end`
بچه وسطِ کار بیرون رفت. همان `summary` + `abandoned: true`.

---

## ۲) خلاصهٔ جلسه (`summary`)

با `game_complete` و `game_end` می‌آید:

| فیلد | نوع | معنی |
|---|---|---|
| `accuracy` | int | درصدِ پاسخ‌های درستِ همین جلسه |
| `asked` / `correct` / `errors` | int | تعدادِ کل / درست / غلط |
| `hints` | int | تعدادِ راهنمایی |
| `idlePeriods` | int | چند بار بی‌حرکت ماند |
| `avgAnswerMs` | int | میانگینِ زمانِ پاسخ |
| `medianAnswerMs` | int | میانهٔ زمانِ پاسخ (به دورافتاده‌ها حساس نیست) |
| `durationMs` | int | مدتِ جلسه |
| `device` | `mobile` \| `desktop` | نوعِ دستگاه |
| `abandoned` | bool | فقط در `game_end` |
| `topics` | object | تفکیکِ مبحثی (پایین) |

هر کلیدِ `topics`:
```json
"compare": { "label": "مقایسه", "asked": 12, "correct": 9,
             "accuracy": 75, "avgMs": 4300, "hints": 1 }
```
هر بازی می‌تواند فیلدهای خودش را هم اضافه کند (`level`, `score`, `stars`, `coins`, `seconds`).

---

## ۳) مبحث‌ها (`topic`)

برچسبِ فارسی در [`apps/parent/services.py`](../backend/apps/parent/services.py) → `TOPIC_LABELS`.

| کلید | برچسب | درس |
|---|---|---|
| `count` | شمارش | ریاضی |
| `compare` | مقایسه | ریاضی |
| `sort` | ترتیب اعداد | ریاضی |
| `pattern` | الگو | ریاضی |
| `match` | تطبیق و دسته‌بندی | ریاضی |
| `classify` | دسته‌بندی | ریاضی |
| `number-id` | شناختِ عدد | ریاضی |
| `write-number` | نوشتنِ عدد | ریاضی |
| `add` / `subtract` | جمع / تفریق | ریاضی |
| `arithmetic` | محاسبه | ریاضی |
| `balance` | تعادل و جمع | ریاضی |
| `logic` | منطق و جدول | ریاضی |
| `direction` | جهت و مسیر | ریاضی |
| `trace` / `trace-curve` | خط‌کشیدن روی الگو / خط خمیده | نگارش |
| `write-letter` | نوشتنِ حرف | نگارش |
| `letter` | حرف‌شناسی | نگارش |
| `line-shape` | تشخیصِ خطِ صاف و کج | نگارش |
| `classify-science` | دسته‌بندیِ خوراکی‌ها | علوم |
| `listen` | شنیدن و تشخیص | قرآن |
| `quran-find` / `quran-read` / `quran-art` | یافتنِ نعمت‌ها / خواندن / نقاشی | قرآن |

---

## ۴) خواندنِ داده برای تحلیل

```sql
-- همهٔ پاسخ‌های یک بچه با مبحث و زمان
SELECT created_at, game_slug,
       payload->>'topic'   AS topic,
       payload->>'correct' AS correct,
       (payload->>'ms')::int AS ms
FROM games_gameevent
WHERE user_id = %s AND event_type = 'answer'
ORDER BY created_at;
```

```python
# همان چیزی که پنل والدین می‌سازد
from apps.parent.services import build_child_report
report = build_child_report(child)      # kpis, topics, sessions, games, hourly, ...
```

**نکته‌ها برای مدل:**
- `ms` زمانِ فکرکردن است؛ زمانِ خیلی کوتاه با پاسخِ غلط یعنی حدس‌زدن، نه ندانستن.
- `hints` مکملِ `accuracy` است: دقتِ بالا با راهنماییِ زیاد ≠ تسلط.
- `idlePeriods` و `abandoned` نشانهٔ خستگی یا سختیِ بیش‌ازحدِ مرحله‌اند.
- `tier` را با `accuracy` کنار هم ببینید تا بفهمید سختی درست تنظیم شده یا نه.
- بازی‌های نگارش (`trace`, `write-letter`) کیفیتِ خط را می‌سنجند، نه دانشِ درست/غلط —
  در تحلیل با ریاضی یک‌کاسه نکنید.
