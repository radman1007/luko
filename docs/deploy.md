# استقرار لوکو روی سرور مجازی

معماری: **یک سرور، یک دامنه**. nginx فایل‌های استاتیکِ فرانت را می‌دهد و
`/api/*` را به جنگو پروکسی می‌کند — پس مرورگر هیچ preflightِ CORS نمی‌زند و
کدِ فرانت که `/api/v1` نسبی صدا می‌کند، بدونِ تغییر کار می‌کند.

```
اینترنت → nginx :443 ┬─ /            → frontend/dist  (استاتیک)
                     ├─ /api/, /admin → gunicorn (web:8000)
                     └─ /static, /media
                                web ──┬── postgres
                                      └── redis ── worker + beat + ai (کارهای هوش مصنوعی، docs/ai.md)
```

## پیش‌نیاز سرور

| منابع | حداقل | راحت |
|---|---|---|
| CPU | ۲ هسته | ۴ هسته |
| RAM | ۴ GB | ۸ GB |
| دیسک | ۴۰ GB SSD | ۸۰ GB |

نرم‌افزار: Docker و Docker Compose. منطقه: نزدیک به کاربر (تهران).

## گام‌ها

### ۱. کد و پیکربندی
```bash
git clone <repo> luko && cd luko
cp .env.example .env
```
`.env` را پر کنید. کلید را این‌طور بسازید:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```
> با `DJANGO_DEBUG=0`، اگر `DJANGO_SECRET_KEY` تنظیم نشده باشد اپ عمداً بالا نمی‌آید.

### ۲. گواهی TLS
```bash
sudo certbot certonly --standalone -d app.example.com
mkdir -p deploy/certs
sudo cp /etc/letsencrypt/live/app.example.com/{fullchain,privkey}.pem deploy/certs/
```

### ۳. بیلد فرانت
```bash
cd frontend && npm ci && npm run build && cd ..    # خروجی در frontend/dist
```
> nginx همین پوشه را مستقیم سرو می‌کند؛ فرانت داخلِ داکر نمی‌رود.

### ۴. بالا آوردن
```bash
docker compose up -d --build
```
`web` خودش `migrate` و `collectstatic` را اجرا می‌کند.

### ۵. دادهٔ اولیه
```bash
docker compose exec web python manage.py seed_content      # کتاب‌ها و محتوا
docker compose exec web python manage.py sync_games        # بازی‌ها از نامِ فایل‌ها
docker compose exec web python manage.py createsuperuser   # دسترسی به /admin
```

### ۶. بررسی سلامت
```bash
curl -I https://app.example.com/                      # 200
curl https://app.example.com/healthz                  # {"data":{"status":"ok"}}
docker compose ps                                     # همه healthy
docker compose logs -f web
```

## به‌روزرسانی

```bash
git pull
cd frontend && npm ci && npm run build && cd ..
docker compose up -d --build
```
مهاجرت‌ها خودکار اجرا می‌شوند. اگر فقط فرانت عوض شده، بیلدِ فرانت کافی است
(nginx فایل‌ها را از دیسک می‌خواند و ری‌استارت لازم ندارد).

## پشتیبان‌گیری

```bash
# پایگاه‌داده
docker compose exec -T db pg_dump -U luko luko | gzip > backup-$(date +%F).sql.gz

# بازگردانی
gunzip -c backup-2026-01-01.sql.gz | docker compose exec -T db psql -U luko luko
```
`media/` (نقاشی‌های بچه‌ها) هم volume جداست؛ در پشتیبان بگیریدش.

## نکته‌های مهم

- **TLS جای دیگری تمام می‌شود؟** اگر CDN آروان جلوی سرور است و به سرور http
  می‌رسد، `DJANGO_SSL_REDIRECT=0` بگذارید تا حلقه‌ی ریدایرکت نشود. nginx هم باید
  هدرِ `X-Forwarded-Proto` را از CDN بگیرد.
- **X-Frame-Options عمداً SAMEORIGIN است**، نه DENY: بازی‌ها داخلِ iframe هم‌ریشه
  اجرا می‌شوند و با DENY نمایش داده نمی‌شوند.
- **`OTP_EXPOSE_DEV_CODE=0`** در production الزامی است، وگرنه کدِ تأیید در پاسخِ
  API برمی‌گردد.
- **Redis پاک شود مشکلی نیست**: فقط کش است (گزارشِ پنل والدین) و دوباره ساخته
  می‌شود؛ ولی روی همان سرور بماند تا رفت‌وبرگشتِ شبکه نخورد.
- **مهاجرتِ داده از SQLite توسعه** لازم نیست؛ سرور از صفر با `seed_content` و `sync_games` پر می‌شود.

## پایش

```bash
docker compose logs -f web worker            # لاگِ زنده
docker stats                                 # مصرفِ منابع
docker compose exec db psql -U luko -c "SELECT count(*) FROM games_gameevent;"
```
