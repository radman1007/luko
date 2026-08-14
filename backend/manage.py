#!/usr/bin/env python
"""ابزار خط‌فرمان Django برای کارهای مدیریتی."""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _venv_python() -> Path | None:
    """مسیرِ پایتونِ محیط مجازیِ پروژه، اگر ساخته شده باشد."""
    venv = BASE_DIR / ".venv"
    for candidate in (venv / "bin" / "python", venv / "Scripts" / "python.exe"):
        if candidate.exists():
            return candidate
    return None


def _reexec_inside_venv() -> None:
    """
    اگر دستور با پایتونِ سیستم اجرا شود، وابستگی‌ها (celery، redis، …) پیدا نمی‌شوند و
    تریس‌بکِ گیج‌کننده می‌دهد. به‌جای آن، خودمان با پایتونِ .venv دوباره اجرا می‌کنیم.
    """
    python = _venv_python()
    if python is None:
        return
    if Path(sys.prefix).resolve() == (BASE_DIR / ".venv").resolve():
        return  # همین حالا داخل venv هستیم
    if os.environ.get("LUKO_SKIP_VENV") == "1":
        return  # فرار اضطراری
    sys.stderr.write(
        "\n⚠️  محیط مجازی فعال نبود؛ با .venv/bin/python ادامه می‌دهم.\n"
        "   برای اجرای مستقیم اول این را بزنید:  source .venv/bin/activate\n\n"
    )
    os.execv(str(python), [str(python), *sys.argv])


def main():
    _reexec_inside_venv()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django نصب نیست؟ محیط مجازی را فعال و requirements.txt را نصب کنید:\n"
            "  source .venv/bin/activate && pip install -r requirements.txt"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
