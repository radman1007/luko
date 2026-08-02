# بک‌اند LUKO

بک‌اندِ پلتفرمِ آموزشیِ کودکانِ LUKO با **Django + Django REST Framework**.

- **دیتابیس: PostgreSQL** — انتخاب‌شده به‌جای MySQL چون: `JSONB` برای وضعیت باغچه و
  رویدادهای تحلیلیِ بازی‌ها، تایپ‌های غنی‌تر، هم‌زمانیِ بهتر (MVCC) و آمادگی برای
  تحلیل‌های سنگینِ آینده (با LLM).
- **Redis** — قلبِ سرعت: هم لایه‌ی cache برای خلاصه‌ها/نماها و هم broker برای
  ریست‌های زمان‌بندی‌شده‌ی Celery.
- قراردادِ سیم با فرانت: بدنه‌ی **camelCase** و پاکتِ `{ "data": ... }` / `{ "error": ... }`.
  همه‌ی APIها زیر `/(api/v1)` (منطبق با `VITE_API_URL` فرانت). پروکسیِ dev فرانت روی
  `localhost:8000` تنظیم است.

## اجرا با Docker (پیشنهادی)
```bash
cp .env.example .env          # مقادیر را در صورت نیاز عوض کنید
docker compose up --build
# مهاجرت + seedِ داده‌های پیش‌فرض خودکار اجرا می‌شود
docker compose exec web python manage.py createsuperuser
```
سرویس‌ها: `web` (API 8000)، `db` (Postgres)، `redis`، `worker` و `beat` (Celery).

## اجرای دستی (بدون Docker)
نیازمند Postgres و Redis روشن. (Python 3.12 توصیه می‌شود.)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_luko          # مأموریت/ورزش/مدال/فروشگاه‌های پیش‌فرض
python manage.py createsuperuser
python manage.py runserver 8000
# در ترمینال‌های جدا (برای ریست‌های زمان‌بندی‌شده):
celery -A config worker -l info
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```
> چکِ سریعِ بدونِ Postgres: `USE_SQLITE=1` در `.env`.

## نقشه‌ی API (خلاصه)
| بخش | متد و مسیر |
|---|---|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` |
| **پروفایل** | `GET /users/me/profile` (سکه/امتیاز/بازی/مدال/استریک/گنج/لوکوریان) |
| **تنظیمات** | `GET,PATCH /users/me/settings` (صدا/موسیقی/یادآور + `extra` برای گزینه‌های آینده) |
| **گنج** | `GET /treasures` |
| **لوکوریان** | `GET,PATCH /users/me/lukorian`, `POST .../unlock`, `POST .../buy`, `POST .../custom-request` |
| **سلامت** | `GET /moods/prompt` (هر ۳۰ دقیقه)، `POST /moods/checkin`، `POST,GET /paintings`، `GET,POST /secrets`, `DELETE /secrets/{id}` |
| **کلاب** | `GET /club/summary`, `POST /club/missions/{id}/complete`, `POST /club/shop/{key}/redeem`, `POST /club/suggest` (معلم/والد) |
| **باغچه** | `GET /garden/state`, `POST /garden/water|fertilize|plant`, `POST /garden/buy`, `GET /garden/shop` |
| **بازی‌ها** | `GET /games`, `POST /games/{slug}/complete` (پاداشِ سمت‌سرور)، `POST /games/events` (تحلیل) |

## نکته‌های کلیدی
- **همه‌ی مقادیر باارزش سمت سرور معتبرند** (سکه/گنج/شبنم/مدال). فرانت فقط نمایش می‌دهد.
- **کاملاً از پنل ادمین قابل‌ویرایش**: مأموریت‌ها و تسک‌های ورزشی (ثابتِ روزانه یا نسبت‌دادنِ
  دستی به یک بچه)، مدال‌ها (تعداد/شرط/آستانه)، فروشگاهِ کلاب و فروشگاهِ باغچه.
- **معلم/والدین** با `POST /club/suggest` مأموریتِ پیشنهادی (امتیاز کمی بیشتر) می‌گذارند.
- **این هفته** تاریخ‌محور و شنبه‌شروع است؛ هر شنبه خودبه‌خود وارد هفته‌ی جدید می‌شود
  (تسکِ `rollover_week`).
- **باغچه** هر فصلِ تقویمی ریست و با تمِ همان فصل بالا می‌آید (lazy موقعِ خواندن +
  تسکِ روزانه‌ی `apply_seasonal_resets`).
- **رازها**: `payload` سمت کلاینت با AES-GCM رمز می‌شود؛ سرور فقط متنِ رمزشده را
  نگه می‌دارد و رمزِ بچه را هرگز نمی‌بیند.
- **Redis-first**: خلاصه‌ها (پروفایل/کلاب/باغچه/فروشگاه‌ها) cache می‌شوند و با هر
  نوشتنِ مرتبط، دقیقاً همان کلید باطل می‌شود (`apps/common/cache.py`). اگر Redis پایین
  باشد، `IGNORE_EXCEPTIONS` باعث می‌شود اپ نخوابد و به DB برگردد.

## آماده برای فازِ بعد
- **تحلیلِ بازی‌ها با LLM**: مدلِ `GameEvent` (JSONB) رویدادهای هر بازی را جمع می‌کند.
- **پنل والدین/معلم**: مدلِ `User.guardians`/`children` و endpointِ `suggest` پایه‌ی
  کنترل و نظارتِ آینده‌اند.
