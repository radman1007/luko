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
| **Auth** | `POST /auth/request-otp`, `POST /auth/verify-otp`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` |
| **پروفایل** | `GET /users/me/profile` (سکه/امتیاز/بازی/مدال/استریک/گنج/لوکوریان) |
| **تنظیمات** | `GET,PATCH /users/me/settings` (صدا/موسیقی/یادآور + `extra` برای گزینه‌های آینده) |
| **گنج** | `GET /treasures` |
| **لوکوریان** | `GET,PATCH /users/me/lukorian`, `POST .../unlock`, `POST .../buy`, `POST .../custom-request` |
| **سلامت** | `GET /moods/prompt` (هر ۳۰ دقیقه)، `POST /moods/checkin`، `POST,GET /paintings`، `GET,POST /secrets`, `DELETE /secrets/{id}` |
| **کلاب** | `GET /club/summary`, `POST /club/missions/{id}/complete`, `POST /club/shop/{key}/redeem`, `POST /club/suggest` (معلم/والد) |
| **باغچه** | `GET /garden/state`, `POST /garden/water|fertilize|plant`, `POST /garden/buy`, `GET /garden/shop` |
| **بازی‌ها** | `GET /books` (کتاب‌ها + مراحل)، `GET /games`, `POST /games/{slug}/complete` (پاداشِ سمت‌سرور)، `POST /games/events` (تحلیل) |
| **محتوا** | `GET /videos`, `POST /videos/{id}/interaction`, `GET /podcasts`, `POST /podcasts/{id}/listen`, `GET /traffic-rules`, `GET /recipes` |
| **سلامت (ادامه)** | `GET,POST /breathing/sessions` |
| **پنل والدین** | `GET,POST /parent/children`, `DELETE /parent/children/{id}`, `GET /parent/children/{id}/report` |
| **پشتیبانی** | `GET,POST /tickets`, `POST /tickets/{id}/reply` |

## پنل والدین

- `ParentChild` پیوندِ والد↔فرزند است و **تنها** مبنای دسترسی؛ هیچ والدی گزارشِ بچه‌ی
  دیگری را نمی‌بیند (تست: `apps/parent/tests.py`).
- `GET /parent/children/{id}/report` دقیقاً همان ساختاری را می‌دهد که
  `features/parent/types.ts` در فرانت انتظار دارد: `kpis`، `week`، `accuracyTrend`،
  `subjects`، `games`، `moods`، `insights`، `wellbeing`.
- همه‌ی اعداد از دادهٔ واقعی ساخته می‌شوند (رویدادهای بازی، تکمیل‌ها، مأموریت‌ها،
  ثبت‌حال‌ها). بچه‌ی بدون داده هم همان ساختار را با مقدارهای صفر می‌گیرد.
- `insights` فعلاً **قاعده‌محور** است و هر جمله پشتش عدد دارد؛ جای مدلِ زبانی بعداً
  همین‌جاست (`apps/parent/services.py::_insights`).
- افزودن فرزند با شماره‌ی موبایل انجام می‌شود؛ اگر حساب نبود ساخته می‌شود.
  نقشِ `parent` را فعلاً باید از پنل ادمین ست کرد.

## محتوا (ادمین‌ویرایش‌پذیر)

ویدیو، پادکست، قانونِ جاده و خوراکیِ روز همه مدل‌اند و از پنل ادمین اضافه/ویرایش
می‌شوند. «امروز» تاریخ‌محور است (شماره‌ی روزِ سال) تا همه‌ی بچه‌ها در یک روز یک
چیز ببینند. دادهٔ اولیه:

```bash
python manage.py seed_luko      # مأموریت/مدال/فروشگاه
python manage.py seed_content   # ویدیو/پادکست/قانون/خوراکی/کتاب‌ها و مراحل
```

## پیامک و ورود با OTP

ورود و ثبت‌نام یکپارچه‌اند: `POST /auth/request-otp` کد می‌فرستد و `POST /auth/verify-otp`
کد را چک می‌کند و اگر حساب نبود می‌سازد. کد پنج‌رقمی، دو دقیقه اعتبار، شصت ثانیه فاصله تا
ارسال مجدد و پنج تلاشِ اشتباه؛ همه در Redis (`apps/accounts/otp.py`).

ارسال از `apps/common/sms.py` انجام می‌شود و ارائه‌دهنده‌ی فعلی **sms.ir** است
(سرویس «ارسال کد تایید»: `POST https://api.sms.ir/v1/send/verify` با هدر `x-api-key`).

| متغیر `.env` | کار |
|---|---|
| `SMS_BACKEND` | `console` (فقط لاگ، برای توسعه) یا `smsir` (ارسال واقعی) |
| `SMS_IR_API_KEY` | کلید پنل sms.ir — سندباکس برای تست، پروداکشن برای انتشار |
| `SMS_IR_TEMPLATE_ID` | شناسه‌ی «قالب کد تایید» که در پنل sms.ir ساخته می‌شود |
| `SMS_IR_PARAM_NAME` | نام پارامتر داخل همان قالب (پیش‌فرض `CODE`) |
| `OTP_EXPOSE_DEV_CODE` | اگر ۱ باشد کد در پاسخ API هم می‌آید؛ **در پروداکشن ۰** |

```bash
python manage.py send_test_sms --check          # پیکربندی + اعتبار حساب
python manage.py send_test_sms 09121234567      # ارسال واقعی یک کد
```

### مسیرِ رسیدن به پیامکِ واقعی (به ترتیب)

۱. در پنل sms.ir → «خدمات ابری» → «کد تایید» یک قالب بسازید؛ متنش باید پارامتر داشته باشد،
   مثلاً: `کد ورود شما به لوکو: {CODE}` (نامِ پارامتر هرچه گذاشتید باید با `SMS_IR_PARAM_NAME` یکی باشد).
۲. شناسه‌ی همان قالب را در `.env` بگذارید: `SMS_IR_TEMPLATE_ID=…`
۳. `SMS_BACKEND=smsir` و `SMS_IR_API_KEY` را روی **کلید پروداکشن** بگذارید.
   کلیدِ سندباکس پیامکِ واقعی تحویل نمی‌دهد؛ فقط پاسخِ API را شبیه‌سازی می‌کند.
۴. اعتبار حساب را چک کنید: `python manage.py send_test_sms --check`
۵. یک پیامکِ واقعی به شماره‌ی خودتان بفرستید: `python manage.py send_test_sms 09xxxxxxxxx`
۶. حالا از فرانت وارد شوید؛ کد باید واقعاً پیامک شود.

**نکته‌های عملیاتی**
- اگر ارسالِ پیامک شکست بخورد، کد و قفلِ ارسالِ مجدد پس گرفته می‌شوند و API خطای ۵۰۲ با
  پیام فارسی می‌دهد؛ کاربر بی‌جهت ۶۰ ثانیه منتظر نمی‌ماند.
- مسیر `request-otp` عمومی است و هر پیامک هزینه دارد، پس علاوه بر قفلِ هر شماره،
  سقفِ **۱۲ درخواست در ساعت برای هر IP** هم اعمال می‌شود (`OTP_IP_MAX`).
- شماره‌ها در لاگ ماسک می‌شوند و کلیدهای API هرگز در کد یا مخزن نیستند.
- `manage.py check` پیکربندیِ پیامک را هم بررسی می‌کند و اگر کلید/قالب نباشد هشدار می‌دهد.
- `manage.py` اگر ببیند محیط مجازی فعال نیست، خودش با `.venv/bin/python` ادامه می‌دهد.

## نکته‌های کلیدی
- **payloadِ رویدادهای بازی دست‌نخورده می‌ماند**: پارسر camelCase با تنظیمِ
  `JSON_CAMEL_CASE.JSON_UNDERSCOREIZE.ignore_fields` از تبدیلِ کلیدهای داخلِ
  JSONFieldها جلوگیری می‌کند؛ وگرنه `durationMs` می‌شد `duration_ms` و تحلیل می‌شکست.
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
