"""
جایگزینِ `django.contrib.admin` در INSTALLED_APPS.

جدا از `apps.py` است چون آن‌جا بودن یعنی دو AppConfig در یک ماژول و جنگو
نمی‌داند کدام پیش‌فرض است.
"""
from django.contrib.admin.apps import AdminConfig


class LukoAdminConfig(AdminConfig):
    """پنلِ ادمین را روی سایتِ سفارشیِ لوکو سوار می‌کند (عنوانِ فارسی + سدِ حدسِ رمز)."""

    default_site = "apps.common.admin_site.LukoAdminSite"
