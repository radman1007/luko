#!/usr/bin/env python
"""ابزار خط‌فرمان Django برای کارهای مدیریتی."""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django نصب نیست؟ محیط مجازی را فعال و requirements.txt را نصب کنید."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
