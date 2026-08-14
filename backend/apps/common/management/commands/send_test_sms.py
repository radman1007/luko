"""
تستِ واقعیِ سرویسِ پیامک بدون دست زدن به فلوی ورود.

    python manage.py send_test_sms 09121234567
    python manage.py send_test_sms 09121234567 --code 11111
    python manage.py send_test_sms --check      # فقط اعتبار و پیکربندی را نشان می‌دهد

هیچ کلیدی اینجا نوشته نشده؛ همه از .env خوانده می‌شود.
"""
import secrets

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.utils import normalize_phone
from apps.common.sms import SmsError, send_verification_code


class Command(BaseCommand):
    help = "ارسال یک پیامکِ کدِ تأیید برای تستِ پیکربندی sms.ir"

    def add_arguments(self, parser):
        parser.add_argument("phone", nargs="?", help="شماره‌ی گیرنده (۰۹...)")
        parser.add_argument("--code", help="کدِ دلخواه؛ پیش‌فرض یک کد تصادفی ۵ رقمی")
        parser.add_argument("--check", action="store_true", help="فقط پیکربندی و اعتبار")

    def handle(self, *args, **options):
        self.stdout.write(f"SMS_BACKEND        = {settings.SMS_BACKEND}")
        self.stdout.write(f"SMS_IR_TEMPLATE_ID = {settings.SMS_IR_TEMPLATE_ID or '(خالی)'}")
        self.stdout.write(f"SMS_IR_PARAM_NAME  = {settings.SMS_IR_PARAM_NAME}")
        key = settings.SMS_IR_API_KEY
        self.stdout.write(f"SMS_IR_API_KEY     = {(key[:4] + '…' + key[-4:]) if key else '(خالی)'}")

        if options["check"]:
            self._show_credit()
            return

        phone = normalize_phone(options.get("phone"))
        if not phone:
            raise CommandError("شماره‌ی معتبر بده؛ مثلاً 09121234567")

        code = options.get("code") or "".join(secrets.choice("0123456789") for _ in range(5))
        try:
            result = send_verification_code(phone, code)
        except SmsError as exc:
            raise CommandError(f"ناموفق: {exc.message} — {exc.detail}") from exc

        self.stdout.write(self.style.SUCCESS(f"ارسال شد → {result} (کد: {code})"))

    def _show_credit(self):
        if not settings.SMS_IR_API_KEY:
            self.stdout.write(self.style.WARNING("کلید API خالی است؛ اعتبار خوانده نشد."))
            return
        try:
            response = requests.get(
                f"{settings.SMS_IR_BASE_URL.rstrip('/')}/v1/credit",
                headers={"x-api-key": settings.SMS_IR_API_KEY, "Accept": "application/json"},
                timeout=settings.SMS_IR_TIMEOUT,
            )
            body = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise CommandError(f"خواندنِ اعتبار ناموفق بود: {exc}") from exc

        if body.get("status") == 1:
            self.stdout.write(self.style.SUCCESS(f"اعتبار حساب: {body.get('data')}"))
        else:
            self.stdout.write(self.style.ERROR(f"پاسخ سرویس: {body}"))
