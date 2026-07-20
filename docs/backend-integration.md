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
| `auth/AuthProvider` | `luko_access_token`, `luko_guest` | `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh` (TODO در api.ts) |
| `health/useMoodReminder` | `luko_last_mood`, `luko_last_mood_time` | `POST /moods/checkin`, `GET /moods/prompt` |
| `health/useBreathing` | — (فقط state) | `POST /breathing/sessions` (ثبت جلسه‌ی کامل‌شده) |
| `health/useGarden` | `luko_garden` | `GET/POST /garden/state`, `POST /garden/water` |
| `health/useSecrets` | `luko_secrets` | `GET/POST/DELETE /secrets` — payload رمزنگاری‌شده سمت کلاینت بماند (سرور متن خام نبیند) |
| `health/artLog` | `luko_art_log` | `POST /moods/art` (حال + رنگ‌ها + بندانگشتی برای تحلیل) |
| `club/useClub` | `luko_coins`, `luko_club_*`, `luko_sport_done_*` | `GET /club/summary`, `GET/POST /club/tasks`, `GET /club/rewards`, `POST /club/rewards/:id/redeem`, `GET /club/badges`, `GET /club/streak` |
| `tv/useLikes` + `tvData` | `luko_tv_likes` | `GET /videos`, `GET /videos/categories`, `POST /videos/:id/interaction` |
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
