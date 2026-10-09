#!/usr/bin/env bash
# بررسی‌های پیش از استقرار. قبل از هر `docker compose up` روی سرور اجرا کنید.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
ok()   { printf '  ✓ %s\n' "$1"; }
bad()  { printf '  ✗ %s\n' "$1"; fail=1; }

echo "── پیکربندی ──"
[ -f .env ] || bad ".env نیست (از .env.example کپی کنید)"
if [ -f .env ]; then
  set -a; . ./.env; set +a
  [ -n "${DJANGO_SECRET_KEY:-}" ] && [ ${#DJANGO_SECRET_KEY} -ge 50 ] \
    && ok "SECRET_KEY تنظیم و به‌اندازه‌ی کافی بلند است" \
    || bad "DJANGO_SECRET_KEY خالی یا کوتاه‌تر از ۵۰ کاراکتر است"
  [ "${DJANGO_DEBUG:-1}" = "0" ] && ok "DEBUG خاموش است" || bad "DJANGO_DEBUG باید 0 باشد"
  [ -n "${POSTGRES_PASSWORD:-}" ] && ok "رمزِ پایگاه‌داده تنظیم است" || bad "POSTGRES_PASSWORD خالی است"
  [ -n "${LUKO_DOMAIN:-}" ] && ok "دامنه: $LUKO_DOMAIN" || bad "LUKO_DOMAIN خالی است"
  [ "${OTP_EXPOSE_DEV_CODE:-1}" = "0" ] && ok "کدِ OTP در پاسخ برنمی‌گردد" \
    || bad "OTP_EXPOSE_DEV_CODE باید در production صفر باشد"
  [ "${SMS_BACKEND:-console}" = "smsir" ] && ok "پیامک روی sms.ir است" \
    || echo "  ! SMS_BACKEND=console — پیامکِ واقعی ارسال نمی‌شود"
fi

echo "── گواهی TLS ──"
[ -f deploy/certs/fullchain.pem ] && [ -f deploy/certs/privkey.pem ] \
  && ok "گواهی موجود است" || bad "deploy/certs/{fullchain,privkey}.pem نیست"

echo "── بیلد فرانت ──"
[ -f frontend/dist/index.html ] && ok "frontend/dist ساخته شده" \
  || bad "frontend/dist نیست — «cd frontend && npm ci && npm run build»"
[ -d frontend/dist/games ] && ok "بازی‌ها در بیلد هستند" || bad "بازی‌ها در dist نیستند"

echo "── داشبورد ──"
if [ -f deploy/dashboard.conf ]; then
  grep -q "__DASHBOARD_PATH__" deploy/dashboard.conf && bad "deploy/dashboard.conf هنوز مسیرِ نمونه دارد" \
    || ok "deploy/dashboard.conf هست"
else
  bad "deploy/dashboard.conf نیست (از dashboard.example.conf بسازید؛ بی‌آن nginx بالا نمی‌آید)"
fi
[ -n "${DASHBOARD_PATH:-}" ] && [ ${#DASHBOARD_PATH} -ge 24 ] && ok "DASHBOARD_PATH بلند است" \
  || bad "DASHBOARD_PATH خالی یا کوتاه‌تر از ۲۴ نویسه است"

echo "── فایل‌های استقرار ──"
for f in docker-compose.yml backend/Dockerfile deploy/nginx.conf.template deploy/proxy.conf; do
  [ -f "$f" ] && ok "$f" || bad "$f نیست"
done

echo
[ $fail -eq 0 ] && echo "✅ آماده‌ی استقرار — docker compose up -d --build" \
                || echo "❌ موارد بالا را درست کنید و دوباره اجرا کنید"
exit $fail
