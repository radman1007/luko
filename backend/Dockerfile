# ---------- بیلد در دو مرحله: وابستگی‌ها جدا تا لایه‌ی کش نسوزد ----------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---------- ایمیجِ نهایی ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings

WORKDIR /app

# فقط کتابخانه‌ی رانتایمِ postgres — نه ابزارِ بیلد
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

# اجرا با کاربرِ غیرruot
RUN useradd --create-home --shell /bin/bash luko \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R luko:luko /app
USER luko

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:8000/healthz || exit 1

# workerها: (۲ × هسته) + ۱ — با متغیرِ محیطی قابلِ تنظیم
CMD ["sh", "-c", "gunicorn config.wsgi:application \
     --bind 0.0.0.0:8000 \
     --workers ${GUNICORN_WORKERS:-3} \
     --timeout ${GUNICORN_TIMEOUT:-60} \
     --access-logfile - --error-logfile -"]
