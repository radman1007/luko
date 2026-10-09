"""
پنلِ ادمینِ لوکو — عنوان‌های فارسی و سدِ حدسِ رمز.

پنل روی اینترنتِ باز است، پس نشانیِ غیرِحدس‌زدنی تنها لایه نیست: فرمِ ورودِ
پیش‌فرضِ جنگو هیچ سقفی روی تلاشِ ناموفق ندارد و با یک اسکریپت می‌شود شبانه
هزاران رمز امتحان کرد. این‌جا شمارنده‌ی هر IP نگه داشته می‌شود و بعد از چند
شکستِ پیاپی، فرم برای همان IP بسته می‌شود.

عمداً روی IP است نه نام کاربری: مهاجم نامِ کاربری را عوض می‌کند، ولی از یک
IP می‌آید. شمارنده با ورودِ موفق پاک می‌شود تا خطای واقعیِ خودِ تیم دردسر
نشود.
"""
import hashlib
import logging

from django.contrib import admin
from django.core.cache import cache
from django.shortcuts import render

log = logging.getLogger("luko.admin")

#: سقفِ شکست برای یک IP، و سقفِ جداگانه برای یک حساب. هر دو ۱۵ دقیقه‌ای‌اند.
#:
#: چرا دو تا: `X-Forwarded-For` را کلاینت می‌فرستد و nginx با
#: `set_real_ip_from 0.0.0.0/0` همه را باور می‌کند، پس مهاجم می‌تواند با
#: عوض کردنِ هدر، شمارنده‌ی IP را دور بزند. شمارنده‌ی حساب دورزدنی نیست —
#: هر تلاش بالاخره روی یک نامِ کاربری می‌نشیند.
#:
#: سقفِ حساب عمداً بالاتر است: پایین بودنش یعنی هر کسی می‌تواند با چند
#: تلاشِ الکی، خودِ تیم را بیرونِ در نگه دارد.
MAX_FAILURES_PER_IP = 8
MAX_FAILURES_PER_ACCOUNT = 20
BLOCK_SECONDS = 15 * 60


#: برچسبِ فارسیِ اپ‌هایی که مالِ خودمان نیستند و ترجمه‌ی فارسی همراه ندارند.
#: کلید، `app_label` است.
FOREIGN_APP_LABELS = {
    "django_celery_beat": "زمان‌بندیِ کارهای خودکار",
    "auth": "گروه‌ها و دسترسی‌ها",
}

#: برچسبِ فارسیِ مدل‌هایشان. کلید «app_label.object_name» است.
FOREIGN_MODEL_LABELS = {
    "django_celery_beat.PeriodicTask": "کارهای زمان‌بندی‌شده",
    "django_celery_beat.CrontabSchedule": "زمان‌بندی کرون",
    "django_celery_beat.IntervalSchedule": "زمان‌بندی دوره‌ای",
    "django_celery_beat.ClockedSchedule": "اجرا در ساعتِ معین",
    "django_celery_beat.SolarSchedule": "زمان‌بندی خورشیدی",
}

#: ترتیبِ نمایشِ اپ‌ها. جنگو الفبایی می‌چیند و آن‌وقت «کاربران» — که تیم
#: بیشتر از همه سراغش می‌رود — وسطِ فهرست گم می‌شود.
APP_ORDER = [
    "accounts", "parent", "games", "club", "garden", "health",
    "content", "support", "auth", "django_celery_beat",
]


def client_ip(request) -> str:
    """پشتِ nginx، IP واقعی در اولین مقدارِ X-Forwarded-For است."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _ip_key(ip: str) -> str:
    return f"admin:login-fail:ip:{ip}"


def _account_key(username: str) -> str:
    # نامِ کاربری از کاربر می‌آید؛ هش می‌شود تا شماره‌ی تلفن داخلِ کلیدِ
    # ردیس (و لاگِ احتمالی‌اش) ننشیند.
    digest = hashlib.sha256(username.strip().encode()).hexdigest()[:32]
    return f"admin:login-fail:user:{digest}"


def _count(key: str) -> int:
    try:
        return cache.get(key, 0)
    except Exception:                                       # noqa: BLE001
        # کشِ خراب نباید ورودِ خودِ تیم را ببندد؛ رمز همچنان سرِ جایش است
        return 0


def _bump(key: str) -> int:
    try:
        value = cache.get(key, 0) + 1
        cache.set(key, value, BLOCK_SECONDS)
        return value
    except Exception:                                       # noqa: BLE001
        log.exception("شمارنده‌ی ورودِ ادمین کار نکرد")
        return 0


class LukoAdminSite(admin.AdminSite):
    site_header = "پنلِ مدیریتِ لوکو"
    site_title = "مدیریتِ لوکو"
    index_title = "همه‌ی داده‌های لوکو"
    empty_value_display = "—"

    def has_permission(self, request):
        """
        پنلِ جنگو فقط برای مدیرِ کل. کارمندان (نویسنده، پشتیبان و …) از داشبورد کار
        می‌کنند که ورودِ دومرحله‌ای و دسترسیِ تیک‌به‌تیک دارد؛ این‌جا فقط رمز است.
        """
        return bool(request.user.is_active and request.user.is_superuser)

    def login(self, request, extra_context=None):
        ip = client_ip(request)
        username = (request.POST.get("username") or "") if request.method == "POST" else ""

        if request.method == "POST":
            ip_fails = _count(_ip_key(ip))
            account_fails = _count(_account_key(username)) if username else 0
            if ip_fails >= MAX_FAILURES_PER_IP or account_fails >= MAX_FAILURES_PER_ACCOUNT:
                log.warning("ورودِ ادمین بسته است — ip=%s (%s شکست)، حساب (%s شکست)",
                            ip, ip_fails, account_fails)
                return render(request, "admin/login_blocked.html", status=429)

        response = super().login(request, extra_context)

        if request.method == "POST":
            if request.user.is_authenticated:
                try:
                    cache.delete(_ip_key(ip))
                    if username:
                        cache.delete(_account_key(username))
                except Exception:                           # noqa: BLE001
                    log.exception("پاک کردنِ شمارنده‌ی ورود کار نکرد")
            else:
                count = _bump(_ip_key(ip))
                if username:
                    _bump(_account_key(username))
                log.warning("ورودِ ناموفقِ ادمین از %s (%s)", ip, count)

        return response

    def get_app_list(self, request, app_label=None):
        """
        فهرستِ صفحه‌ی اول: برچسبِ فارسی برای اپ‌های بیرونی، و ترتیبی که به
        کارِ تیم بخورد.

        نامِ اپ‌های بیرونی همین‌جا عوض می‌شود نه روی `Meta`ی خودشان: تغییرِ
        `Meta` را `makemigrations` می‌بیند و می‌خواهد داخلِ پکیجِ نصب‌شده
        مهاجرت بسازد.
        """
        app_list = super().get_app_list(request, app_label)

        for app in app_list:
            label = app.get("app_label", "")
            if label in FOREIGN_APP_LABELS:
                app["name"] = FOREIGN_APP_LABELS[label]
            for model in app.get("models", []):
                key = f"{label}.{model.get('object_name')}"
                if key in FOREIGN_MODEL_LABELS:
                    model["name"] = FOREIGN_MODEL_LABELS[key]
            app["models"].sort(key=lambda m: m["name"])

        rank = {name: i for i, name in enumerate(APP_ORDER)}
        app_list.sort(key=lambda a: (rank.get(a.get("app_label", ""), len(rank)), a["name"]))
        return app_list
