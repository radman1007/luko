"""
تشخیصِ سلامتِ سرویسِ پیامک.

    python manage.py sms_check                 # فقط پیکربندی را بررسی می‌کند
    python manage.py sms_check --to 09121234567  # یک پیامکِ واقعی هم می‌فرستد

چرا لازم است: در حالتِ `console` هیچ پیامکی ارسال نمی‌شود و کاربر فقط می‌بیند
«کد ارسال شد» ولی چیزی نمی‌رسد. این دستور دقیقاً می‌گوید کجای زنجیره ایراد دارد.
"""
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.common.sms import SmsError, get_sms_backend


class Command(BaseCommand):
    help = "بررسیِ پیکربندی و ارسالِ آزمایشیِ پیامک"

    def add_arguments(self, parser):
        parser.add_argument("--to", help="شماره‌ی مقصد برای ارسالِ آزمایشی")
        parser.add_argument("--code", default="12345", help="کدِ آزمایشی")

    def handle(self, *args, **options):
        ok = self.style.SUCCESS
        bad = self.style.ERROR
        warn = self.style.WARNING

        backend_name = (settings.SMS_BACKEND or "console").lower()
        self.stdout.write("── پیکربندی ──")
        self.stdout.write(f"  SMS_BACKEND         : {backend_name}")

        if backend_name == "console":
            self.stdout.write(warn(
                "  ⚠️  حالتِ console: هیچ پیامکی ارسال نمی‌شود و کد فقط در لاگ می‌آید.\n"
                "      برای ارسالِ واقعی SMS_BACKEND=melipayamak بگذارید."
            ))

        mp_key = settings.MELIPAYAMAK_API_KEY or ""
        key = settings.SMS_IR_API_KEY or ""
        tid = settings.SMS_IR_TEMPLATE_ID or 0
        shown = lambda v: f"تنظیم شده ({len(v)} کاراکتر)" if v else "خالی"   # noqa: E731
        self.stdout.write(f"  MELIPAYAMAK_API_KEY : {shown(mp_key)}")
        self.stdout.write(f"  MELIPAYAMAK_BASE_URL: {settings.MELIPAYAMAK_BASE_URL}")
        self.stdout.write(f"  SMS_IR_API_KEY      : {shown(key)} (ارائه‌دهنده‌ی قبلی)")
        self.stdout.write(f"  SMS_IR_TEMPLATE_ID  : {tid or 'خالی'}")
        self.stdout.write(f"  OTP_EXPOSE_DEV_CODE : {settings.OTP_EXPOSE_DEV_CODE} (در production باید 0 باشد)")

        problems = []
        if backend_name == "melipayamak" and not mp_key:
            problems.append("MELIPAYAMAK_API_KEY خالی است")
        if backend_name == "smsir":
            if not key:
                problems.append("SMS_IR_API_KEY خالی است")
            if not tid:
                problems.append("SMS_IR_TEMPLATE_ID خالی است")

        if problems:
            self.stdout.write(bad("\n── ایرادها ──"))
            for p in problems:
                self.stdout.write(bad(f"  ✗ {p}"))
            self.stdout.write(warn("\n  با این وضع، درخواستِ کد به کاربر خطای ۵۰۲ می‌دهد."))
            return

        if backend_name in {"smsir", "melipayamak"}:
            self.stdout.write(ok("\n  ✓ پیکربندی کامل است."))

        to = options.get("to")
        if not to:
            self.stdout.write("\n  برای ارسالِ آزمایشی: --to 09xxxxxxxxx")
            return

        self.stdout.write(f"\n── ارسالِ آزمایشی به {to} ──")
        try:
            result = get_sms_backend().send_verify(to, options["code"])
        except SmsError as exc:
            self.stdout.write(bad(f"  ✗ ناموفق: {exc.message}"))
            self.stdout.write(bad(f"    جزئیات: {exc.detail}"))
            return
        self.stdout.write(ok(f"  ✓ ارسال شد — {result}"))
