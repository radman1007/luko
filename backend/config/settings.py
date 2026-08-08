"""
تنظیمات Django برای بک‌اند LUKO.

سکوی داده: PostgreSQL (JSONB برای وضعیت باغچه و رویدادهای تحلیلی).
لایه‌ی سرعت: Redis — هم cache صفحه/خلاصه‌ها و هم broker سلری برای ریست‌های زمان‌بندی‌شده.
قرارداد سیم با فرانت: بدنه‌ی camelCase و پاکت { data | error } (renderers.py).
"""
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def env_bool(key: str, default: bool = False) -> bool:
    return env(key, "1" if default else "0").strip().lower() in {"1", "true", "yes", "on"}


def env_list(key: str, default: str = "") -> list[str]:
    return [x.strip() for x in env(key, default).split(",") if x.strip()]


# ---------------------------------------------------------------------------
# پایه
# ---------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "corsheaders",
    "django_filters",
    "django_celery_beat",
    # local apps
    "apps.common",
    "apps.accounts",
    "apps.health",
    "apps.club",
    "apps.garden",
    "apps.games",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# دیتابیس — PostgreSQL (پیش‌فرض) با گزینه‌ی SQLite برای چک سریع
# ---------------------------------------------------------------------------
if env_bool("USE_SQLITE", False):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB", "luko"),
            "USER": env("POSTGRES_USER", "luko"),
            "PASSWORD": env("POSTGRES_PASSWORD", "luko"),
            "HOST": env("POSTGRES_HOST", "localhost"),
            "PORT": env("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 60,
            "CONN_HEALTH_CHECKS": True,
        }
    }

# ---------------------------------------------------------------------------
# Redis — cache (django-redis). کلیدها و helperها در apps/common/cache.py
# ---------------------------------------------------------------------------
REDIS_CACHE_URL = env("REDIS_CACHE_URL", "redis://localhost:6379/1")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_CACHE_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "IGNORE_EXCEPTIONS": True,  # اگر Redis پایین بود، اپ نخوابد (fallback به DB)
            # redis-py اگر hiredis نصب باشد خودش parserِ سریع را برمی‌دارد.
        },
        "KEY_PREFIX": "luko",
        "TIMEOUT": 300,
    }
}
DJANGO_REDIS_IGNORE_EXCEPTIONS = True

# ---------------------------------------------------------------------------
# Celery — broker/backend روی Redis؛ ریست‌های هفتگی/فصلی
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", "redis://localhost:6379/0")
CELERY_TIMEZONE = "Asia/Tehran"
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_EAGER", False)
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# ---------------------------------------------------------------------------
# پیامک (OTP) — sms.ir
# کلیدها فقط از .env خوانده می‌شوند و هرگز کامیت نمی‌شوند.
# SMS_BACKEND=console یعنی چیزی ارسال نمی‌شود و کد فقط در لاگ می‌آید (توسعه).
# ---------------------------------------------------------------------------
SMS_BACKEND = env("SMS_BACKEND", "console" if DEBUG else "smsir")
SMS_IR_API_KEY = env("SMS_IR_API_KEY", "")
SMS_IR_TEMPLATE_ID = env("SMS_IR_TEMPLATE_ID", "")
# نامِ پارامتر داخلِ قالبِ پنل sms.ir (مثلاً {CODE} در متن قالب)
SMS_IR_PARAM_NAME = env("SMS_IR_PARAM_NAME", "CODE")
SMS_IR_BASE_URL = env("SMS_IR_BASE_URL", "https://api.sms.ir")
SMS_IR_TIMEOUT = float(env("SMS_IR_TIMEOUT", "10"))
# در حالتِ توسعه، کد در پاسخِ API هم برگردد تا تست بدون پیامک ممکن باشد
OTP_EXPOSE_DEV_CODE = env_bool("OTP_EXPOSE_DEV_CODE", DEBUG)

# ---------------------------------------------------------------------------
# Django REST Framework + JWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": ("apps.common.renderers.EnvelopeJSONRenderer",),
    "DEFAULT_PARSER_CLASSES": ("djangorestframework_camel_case.parser.CamelCaseJSONParser",),
    "EXCEPTION_HANDLER": "apps.common.exceptions.envelope_exception_handler",
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.DefaultPagination",
    "PAGE_SIZE": 30,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(env("ACCESS_TOKEN_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(env("REFRESH_TOKEN_DAYS", "14"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# i18n / static
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "fa"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 6}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]
