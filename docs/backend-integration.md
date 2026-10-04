# نقشه‌ی اتصال فرانت به بک‌اند

وضعیت فعلی: همه‌ی داده‌ها mock یا localStorage هستند و **هر خواندن/نوشتن فقط از داخل هوک‌ها** انجام می‌شود
(هیچ کامپوننتی مستقیم localStorage یا HTTP صدا نمی‌زند، به‌جز `lib/api.ts` که تنها کلاینت HTTP است).
پس اتصال بک‌اند یعنی: بدنه‌ی هوک را عوض کن، کامپوننت‌ها دست نمی‌خورند.

## زیرساخت آماده
- [lib/api.ts](../frontend/src/lib/api.ts) — axios با interceptor توکن + مدیریت 401؛ baseURL از `VITE_API_URL` (پیش‌فرض `/api/v1`)
- پروکسی dev در [vite.config.ts](../frontend/src/../vite.config.ts): `/api` → `localhost:8000`
- [features/auth/api.ts](../frontend/src/features/auth/api.ts) — login / register / me آماده و متصل به apiClient
- TanStack Query نصب و queryClient آماده است؛ موقع اتصال، هوک‌های زیر به useQuery/useMutation تبدیل شوند

## نقشه‌ی هوک ← endpoint (نام‌ها از بک‌اند پروژه‌ی قبلی)

| هوک / ماژول | کلید localStorage فعلی | endpoint هدف |
|---|---|---|
| `auth/AuthProvider` | `luko_access_token`, `luko_guest` | **متصل شد:** `POST /auth/request-otp`، `POST /auth/verify-otp`، `GET /auth/me` (پیامک واقعی با sms.ir). `POST /auth/refresh` هنوز در `api.ts` وصل نشده. |
| `health/useMoodReminder` | `luko_last_mood`, `luko_last_mood_time` | **هم‌رسان با `/sync`** (بینِ دستگاه‌ها). ثبتِ سروریِ حال (`POST /moods/checkin`) هنوز وصل نیست |
| `health/useBreathing` | — (فقط state) | **آماده شد:** `GET,POST /breathing/sessions` |
| `garden/store` | `luko_garden_state`, `luko_dew_time_*` | **هم‌رسان با `/sync`** (شبنم و مراقبت جمعِ تغییرها، گیاه‌ها به شناسه). `GET/POST /garden/*` هنوز وصل نیست |
| `health/useSecrets` | `luko_secrets` | **هم‌رسان با `/sync`** — همان payloadِ رمزشده، سرور متن خام نمی‌بیند. `GET/POST/DELETE /secrets` هنوز وصل نیست |
| `health/artLog` | `luko_art_log` | **هم‌رسان با `/sync`**؛ گالریِ نقاشی‌ها از `GET/POST /paintings` |
| `club/useClub` | `luko_coins`, `luko_club_*`, `luko_sport_done_*` | **هم‌رسان با `/sync`** (سکه با ادغامِ جمعِ تغییرها، فهرست‌ها با اجتماع). کیفِ سکه‌ی بازی‌ها سمتِ اپ حساب می‌شود؛ `club/summary` و بقیه هنوز وصل نیستند |
| ~~لوکو تلویزیون~~ | — | بخشِ فرانت حذف شد (مرداد ۱۴۰۵)؛ `GET /videos` و مدل‌هایش در بک‌اند نگه داشته شد تا اگر برگشت، آماده باشد |
| `profile/useTreasure` | `luko_treasures` (فقط مهمان) | **متصل شد:** `GET /treasures` — گنج را سرور می‌دهد |
| `profile/useSettings` | `luko_settings` | **هم‌رسان با `/sync`** (هر فیلد جدا). `PATCH /users/me/settings` هنوز وصل نیست |
| `profile` بازی‌های تمام‌شده | `luko_completed_games` | **متصل شد:** `GET /games/completed` (همان پیشرفتِ نقشه) و `POST /games/:slug/complete` |
| `profile/config.ts` | — (ثابت‌ها) | `GET /admin/builder-config` (آستانه‌ها و قیمت‌ها از پنل ادمین) |

## نکته‌های امنیتی هنگام اتصال (مهم)
1. **همه‌ی مقادیر باارزش (سکه، گنج، مدال، باز شدن کارگاه) الان client-side و دستکاری‌پذیرند** — برای MVP اشکالی ندارد ولی با آمدن بک‌اند، محاسبه و اعتبارسنجی این‌ها باید ۱۰۰٪ سمت سرور برود؛ فرانت فقط نمایش می‌دهد.
2. توکن در localStorage است (سازگار با کد قبلی)؛ در صورت امکان بک‌اند refresh token را **httpOnly cookie** بدهد و access کوتاه‌عمر باشد.
3. رازها (`useSecrets`) با AES-GCM + PBKDF2 سمت کلاینت رمز می‌شوند — سرور فقط payload رمزشده را نگه دارد و هرگز رمز بچه را نگیرد.
4. آپلود عکس بچه (کاراکتر اختصاصی): حتماً محدودیت نوع/حجم فایل، اسکن سمت سرور و رضایت والدین لازم است.
5. بازی‌های HTML5 که بعداً در iframe می‌آیند: `sandbox` بگیرند و پیام‌رسانی فقط با postMessage با origin مشخص.

## APIهای تازه‌ی آماده (بک‌اند زده شده، فرانت هنوز وصل نشده)

| فرانت | endpoint |
|---|---|
| `features/parent/api.ts` | `GET/POST /parent/children` · `DELETE /parent/children/{id}` · `GET /parent/children/{id}/report` · `GET/POST /parent/children/{id}/assignments` · `GET /parent/children/{id}/suggestions` · `GET/PATCH /parent/preferences` · `GET /parent/notifications` · `POST /parent/notifications/read` · `GET/POST /tickets` |
| `features/podcast/usePodcasts.ts` · `usePlayer.ts` — **وصل است** (۴ اکتبر ۲۰۲۶) | `GET /podcasts` (+ `today`؛ عمومی، مهمان هم می‌گیرد) · `POST /podcasts/{id}/listen` (پایانِ قسمت، فقط بچه‌ی واردشده). صوت از ادمین بارگذاری می‌شود و زیرِ `/media/podcasts/` سرو می‌شود |
| ~~قانون روز جاده~~ | `GET /traffic-rules` — بخشِ فرانت حذف شد (مرداد ۱۴۰۵)؛ مدل و API در بک‌اند نگه داشته شد تا اگر برگشت، دوباره کار کند |
| ~~آشپزی روز~~ | `GET /recipes` — همان وضعیت |
| `features/games/useGamePath.ts` | `GET /games/path?grade=N` (مسیرِ کلاس — فقط عنوان/ترتیب/هفته/پاداش) |
| تبِ «پشتیبانی» پنل والدین | `GET,POST /tickets` · `POST /tickets/{id}/reply` |
| رویدادهای بازی‌ها (تله‌متری) | `POST /games/events` — تک‌رویداد یا آرایه |

## هم‌رسانیِ داده‌ی دستگاه (`features/sync` ↔ `GET/POST /sync`)
داده‌ای که هنوز سمتِ خودِ اپ حساب می‌شود (کیفِ سکه‌ی بازی‌ها، باغچه، مأموریت‌های امروز، تنظیمات، رازها،
ذخیره‌ی داخلِ هر بازی) برای هر حساب روی سرور نگه داشته و بینِ سایت و اپِ اندروید هم‌رسان می‌شود.
فهرستِ کلیدها و قاعده‌ی ادغامِ هرکدام: [syncKeys.ts](../frontend/src/features/sync/syncKeys.ts)؛ ادغامِ سه‌طرفه:
[merge.ts](../frontend/src/features/sync/merge.ts). وقتی بخشی واقعاً به API خودش وصل شد، کلیدش را از
`syncKeys.ts` بردار تا دو منبع نداشته باشد.
