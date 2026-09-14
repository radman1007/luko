"""
چک‌های سیستمیِ Django برای پیکربندیِ پیامک.

هدف: به‌جای اینکه تازه موقعِ ورودِ کاربر بفهمیم کلید/قالب تنظیم نشده،
همان لحظه‌ی `runserver` یا `check` هشدار بدهیم.
"""
from django.conf import settings
from django.core.checks import Error, Warning, register


@register()
def sms_configuration(app_configs, **kwargs):
    problems = []
    backend = (getattr(settings, "SMS_BACKEND", "") or "").lower()

    if backend not in {"console", "smsir", "melipayamak"}:
        problems.append(Error(
            f"SMS_BACKEND نامعتبر است: {backend!r}",
            hint="در .env یکی از console، smsir یا melipayamak را بگذارید.",
            id="luko.sms.E001",
        ))
        return problems

    if backend == "console":
        if not settings.DEBUG:
            problems.append(Warning(
                "SMS_BACKEND روی console است ولی DEBUG خاموش است — هیچ پیامکی ارسال نمی‌شود.",
                hint="برای ارسالِ واقعی SMS_BACKEND=smsir بگذارید.",
                id="luko.sms.W002",
            ))
        return problems

    # ملی‌پیامک: ارائه‌دهنده‌ی قبلی، برای برگشتِ اضطراری نگه داشته شده
    if backend == "melipayamak":
        if not settings.MELIPAYAMAK_API_KEY:
            problems.append(Warning(
                "MELIPAYAMAK_API_KEY خالی است؛ ارسال پیامک ممکن نیست.",
                hint="کلید را از پنل ملی‌پیامک بردارید و در .env بگذارید.",
                id="luko.sms.W006",
            ))
        if settings.OTP_EXPOSE_DEV_CODE and not settings.DEBUG:
            problems.append(Warning(
                "OTP_EXPOSE_DEV_CODE روشن است ولی DEBUG خاموش؛ کد برنمی‌گردد.",
                hint="برای تمیز شدنِ پیکربندی OTP_EXPOSE_DEV_CODE=0 بگذارید.",
                id="luko.sms.W005",
            ))
        return problems

    # backend = smsir (ارائه‌دهنده‌ی فعلی)
    if not settings.SMS_IR_API_KEY:
        problems.append(Warning(
            "SMS_IR_API_KEY خالی است؛ ارسال پیامک ممکن نیست.",
            hint="کلید را از پنل sms.ir بردارید و در .env بگذارید.",
            id="luko.sms.W003",
        ))
    if not str(settings.SMS_IR_TEMPLATE_ID).strip():
        problems.append(Warning(
            "SMS_IR_TEMPLATE_ID خالی است؛ ارسالِ کد تأیید کار نمی‌کند.",
            hint="در پنل sms.ir یک «قالب کد تایید» بسازید و شناسه‌اش را در .env بگذارید.",
            id="luko.sms.W004",
        ))
    if settings.OTP_EXPOSE_DEV_CODE and not settings.DEBUG:
        problems.append(Warning(
            "OTP_EXPOSE_DEV_CODE روشن است ولی DEBUG خاموش؛ کد برنمی‌گردد (ویو خودش جلویش را می‌گیرد).",
            hint="برای تمیز شدنِ پیکربندی OTP_EXPOSE_DEV_CODE=0 بگذارید.",
            id="luko.sms.W005",
        ))
    return problems
