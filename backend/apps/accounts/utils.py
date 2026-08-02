"""ابزارهای کوچکِ حساب — نرمال‌سازیِ شماره‌ی موبایل."""
import re

# ارقام فارسی/عربی → انگلیسی
_DIGIT_MAP = {ord(c): str(i % 10) for i, c in enumerate("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩")}
_IR_MOBILE = re.compile(r"^09\d{9}$")


def normalize_phone(raw) -> str | None:
    """
    شماره را یکدست می‌کند: ارقام فارسی→انگلیسی، حذف فاصله/خط‌تیره، +98/0098/98→0.
    اگر معتبرِ ایران (۰۹xxxxxxxxx) بود برمی‌گرداند، وگرنه None.
    """
    if not raw:
        return None
    s = str(raw).translate(_DIGIT_MAP)
    s = re.sub(r"[\s\-()]", "", s)
    if s.startswith("+98"):
        s = "0" + s[3:]
    elif s.startswith("0098"):
        s = "0" + s[4:]
    elif s.startswith("98") and len(s) == 12:
        s = "0" + s[2:]
    elif s.startswith("9") and len(s) == 10:
        s = "0" + s
    return s if _IR_MOBILE.match(s) else None
