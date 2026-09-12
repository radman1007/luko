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
import logging

from django.contrib import admin
from django.core.cache import cache
from django.shortcuts import render

log = logging.getLogger("luko.admin")

#: چند شکستِ پیاپی تا بسته شدن، و چند ثانیه بسته بماند
MAX_FAILURES = 8
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


def _key(ip: str) -> str:
    return f"admin:login-fail:{ip}"


class LukoAdminSite(admin.AdminSite):
    site_header = "پنلِ مدیریتِ لوکو"
    site_title = "مدیریتِ لوکو"
    index_title = "همه‌ی داده‌های لوکو"
    empty_value_display = "—"

    def login(self, request, extra_context=None):
        ip = client_ip(request)

        if request.method == "POST":
            try:
                failures = cache.get(_key(ip), 0)
            except Exception:                                   # noqa: BLE001
                # کشِ خراب نباید ورودِ خودِ تیم را ببندد؛ رمز همچنان سرِ جایش است
                failures = 0
            if failures >= MAX_FAILURES:
                log.warning("ورودِ ادمین برای %s بسته است (%s تلاشِ ناموفق)", ip, failures)
                return render(request, "admin/login_blocked.html", status=429)

        response = super().login(request, extra_context)

        if request.method == "POST":
            try:
                if request.user.is_authenticated:
                    cache.delete(_key(ip))
                else:
                    count = cache.get(_key(ip), 0) + 1
                    cache.set(_key(ip), count, BLOCK_SECONDS)
                    log.warning("ورودِ ناموفقِ ادمین از %s (%s)", ip, count)
            except Exception:                                   # noqa: BLE001
                log.exception("شمارنده‌ی ورودِ ادمین کار نکرد")

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
