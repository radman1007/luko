"""
کاتالوگِ بازی‌ها از روی نامِ فایل‌ها.

    python manage.py sync_games              # همگام‌سازی و گزارش
    python manage.py sync_games --check      # فقط گزارش؛ دیتابیس دست نمی‌خورد
    python manage.py sync_games --dir PATH   # پوشه‌ای غیر از GAME_FILES_DIR

قالبِ نام و قاعده‌ها: `apps/games/naming.py` و `apps/games/registry.py`.
فایلِ نامعتبر هیچ‌وقت خطای اجرا نیست — فقط در گزارش (و پنلِ ادمین) «نیاز به
بررسی» می‌شود. خطای اجرا فقط یعنی کلِ کار انجام نشد (پوشه نیست، یا نگهبانِ
ایمنی جلوی حذفِ دسته‌جمعی را گرفت).
"""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.games import registry


class Command(BaseCommand):
    help = "ساختنِ کاتالوگِ بازی‌ها از نامِ فایل‌ها (C1-Kr-F1-S1-G1.html)"

    def add_arguments(self, parser):
        parser.add_argument("--dir", help="پوشه‌ی فایل‌های بازی (پیش‌فرض: GAME_FILES_DIR)")
        parser.add_argument("--check", action="store_true",
                            help="فقط گزارش بده؛ چیزی ذخیره نکن")
        parser.add_argument("--allow-mass-removal", action="store_true",
                            help="اجازه بده بیش از نیمی از بازی‌های مسیر یک‌جا حذف شوند")

    def handle(self, *args, **options):
        root = Path(options["dir"] or settings.GAME_FILES_DIR)
        try:
            result = registry.sync(root, dry_run=options["check"],
                                   allow_mass_removal=options["allow_mass_removal"])
        except (FileNotFoundError, registry.SyncBusy) as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(registry.render(result))
        if result.blocked:
            raise CommandError("همگام‌سازی انجام نشد.")
        if options["check"]:
            self.stdout.write(self.style.WARNING("فقط بررسی بود؛ چیزی ذخیره نشد."))
        else:
            self.stdout.write(self.style.SUCCESS("کاتالوگِ بازی‌ها به‌روز شد."))
