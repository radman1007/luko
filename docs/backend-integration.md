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
| `health/useMoodReminder` | `luko_last_mood`, `luko_last_mood_time` | `POST /moods/checkin`, `GET /moods/prompt` |
| `health/useBreathing` | — (فقط state) | **آماده شد:** `GET,POST /breathing/sessions` |
| `health/useGarden` | `luko_garden` | `GET/POST /garden/state`, `POST /garden/water` |
| `health/useSecrets` | `luko_secrets` | `GET/POST/DELETE /secrets` — payload رمزنگاری‌شده سمت کلاینت بماند (سرور متن خام نبیند) |
| `health/artLog` | `luko_art_log` | `POST /moods/art` (حال + رنگ‌ها + بندانگشتی برای تحلیل) |
| `club/useClub` | `luko_coins`, `luko_club_*`, `luko_sport_done_*` | `GET /club/summary`, `GET/POST /club/tasks`, `GET /club/rewards`, `POST /club/rewards/:id/redeem`, `GET /club/badges`, `GET /club/streak` |
| ~~لوکو تلویزیون~~ | — | بخشِ فرانت حذف شد (مرداد ۱۴۰۵)؛ `GET /videos` و مدل‌هایش در بک‌اند نگه داشته شد تا اگر برگشت، آماده باشد |
| `profile/useTreasure` | `luko_treasures` | `GET/POST /treasures` — **مقدار گنج حتماً سمت سرور محاسبه/اعتبارسنجی شود** |
| `profile/useSettings` | `luko_settings` | `PATCH /users/me/settings` |
| `profile` بازی‌های تمام‌شده | `luko_completed_games` | `POST /games/:id/complete` (سکه هم سمت سرور داده شود) |
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
| `features/podcast/podcastData.ts` | `GET /podcasts` (+ `today`) · `POST /podcasts/{id}/listen` |
| ~~قانون روز جاده~~ | `GET /traffic-rules` — بخشِ فرانت حذف شد (مرداد ۱۴۰۵)؛ مدل و API در بک‌اند نگه داشته شد تا اگر برگشت، دوباره کار کند |
| ~~آشپزی روز~~ | `GET /recipes` — همان وضعیت |
| `features/books/booksData.ts` | `GET /books` (کتاب + مراحل + فهرستِ کامل‌شده‌ها) |
| تبِ «پشتیبانی» پنل والدین | `GET,POST /tickets` · `POST /tickets/{id}/reply` |
| رویدادهای بازی‌ها (تله‌متری) | `POST /games/events` — تک‌رویداد یا آرایه |
