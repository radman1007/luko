from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.common"
    verbose_name = "عمومی"

    def ready(self):
        from . import checks  # noqa: F401 — ثبتِ چک‌های پیکربندیِ پیامک
