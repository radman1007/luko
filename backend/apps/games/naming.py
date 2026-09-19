"""
نامِ فایلِ بازی — تنها جایی که قالبِ C-K-F-S-G تعریف می‌شود.

    C1-Kr-F1-S2-G2.html
    │  │  │  │  └─ G  شماره‌ی بازی در همان هفته (از ۱)
    │  │  │  └──── S  سیزن/هفته داخلِ همان فصل (از ۱)
    │  │  └─────── F  فصل/ماهِ آموزشی (از ۱؛ F1 = مهر)
    │  └────────── K  کتاب — فقط برای دسته‌بندیِ داخلی
    └───────────── C  کلاس (پایه)

جایگاهِ بازی روی مسیر فقط (C, F, S, G) است؛ K در ترتیب هیچ نقشی ندارد و
هیچ‌وقت به بچه نشان داده نمی‌شود. پس در یک هفته دو فایل نمی‌توانند یک G
داشته باشند، حتی اگر کتابشان فرق کند.

این ماژول عمداً به جنگو و دیتابیس وابسته نیست: فقط رشته می‌گیرد و نتیجه
می‌دهد، تا همه‌ی حالت‌های نام‌گذاری بدونِ هیچ زیرساختی تست شوند.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from apps.common.constants import GRADE_CHOICES

EXTENSION = ".html"

#: ترتیبِ استانداردِ بخش‌ها در نام
PARTS = ("C", "K", "F", "S", "G")

PART_LABELS = {
    "C": "کلاس",
    "K": "کتاب",
    "F": "فصل",
    "S": "هفته",
    "G": "شماره‌ی بازی",
}

#: سقفِ هر عدد. بی‌نهایت عملاً یعنی «بزرگ‌تر از هر چیزی که لازم می‌شود»؛
#: این سقف فقط جلوی غلطِ تایپی مثلِ G11111 را می‌گیرد.
MAX_NUMBER = 999

#: کلاس‌هایی که سامانه می‌شناسد — همان پایه‌های حسابِ کاربری
GRADES = frozenset(value for value, _ in GRADE_CHOICES)


@dataclass(frozen=True)
class Book:
    """یک کدِ کتاب. `slug` پیشوندِ شناسه‌ی کتاب است (`math` → `math-1`)."""

    code: str
    slug: str
    name: str


#: کدهای کتاب. کتابِ تازه = یک سطرِ تازه همین‌جا؛ بقیه‌ی سامانه از این می‌خواند.
BOOKS: dict[str, Book] = {
    book.code: book
    for book in (
        Book("r", "math", "ریاضی"),
        Book("o", "science", "علوم"),
        Book("q", "quran", "قرآن"),
        Book("n", "writing", "نگارش"),
        Book("h", "art", "هنر"),
    )
}


@dataclass(frozen=True)
class GameCode:
    """نامِ معتبر، تجزیه‌شده."""

    grade: int
    book: str
    chapter: int
    week: int
    number: int

    @property
    def slot(self) -> tuple[int, int, int, int]:
        """
        جایگاه روی مسیر، و در عینِ حال کلیدِ مرتب‌سازی.
        تاپلِ عددی است، پس G2 پیش از G10 می‌آید (نه مثلِ مرتب‌سازیِ رشته‌ای).
        """
        return (self.grade, self.chapter, self.week, self.number)

    @property
    def slot_label(self) -> str:
        """جایگاه بدونِ کتاب: `C1-F1-S2-G2`."""
        return f"C{self.grade}-F{self.chapter}-S{self.week}-G{self.number}"

    @property
    def book_id(self) -> str:
        """شناسه‌ی کتابِ داخلی (`math-1`) — برای گزارشِ والد، نه برای بچه."""
        return f"{BOOKS[self.book].slug}-{self.grade}"

    @property
    def filename(self) -> str:
        """نامِ استانداردِ همین کد."""
        return (f"C{self.grade}-K{self.book}-F{self.chapter}"
                f"-S{self.week}-G{self.number}{EXTENSION}")

    def __str__(self) -> str:
        return self.filename[: -len(EXTENSION)]


@dataclass(frozen=True)
class ParseResult:
    """
    نتیجه‌ی خواندنِ یک نام.

    `code` فقط وقتی هست که نام معتبر باشد. `errors` دلیلِ نامعتبر بودن است
    و `suggestion` نامِ درست — فقط وقتی که مقصود بی‌ابهام معلوم است (مثلاً
    ترتیب جابه‌جاست). `notes` هشدارهای غیرمسدودکننده‌اند: نام پذیرفته شده
    ولی شکلِ استاندارد را ندارد.
    """

    code: GameCode | None
    errors: tuple[str, ...] = ()
    suggestion: str | None = None
    notes: tuple[str, ...] = field(default=())

    @property
    def ok(self) -> bool:
        return self.code is not None


_FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "0123456789" * 2)
_BOOK_LIST = "، ".join(f"K{b.code} {b.name}" for b in BOOKS.values())


def _read_number(letter: str, raw: str, errors: list[str]) -> int | None:
    label = f"{letter} ({PART_LABELS[letter]})"
    if not raw.isascii() or not raw.isdigit():
        errors.append(f"بعد از {label} باید یک عدد بیاید؛ «{letter}{raw}» عدد نیست.")
        return None
    value = int(raw)
    if value < 1:
        errors.append(f"شماره‌ها از ۱ شروع می‌شوند؛ «{letter}{raw}» معتبر نیست.")
        return None
    if value > MAX_NUMBER:
        errors.append(f"عددِ «{letter}{raw}» بیش از حد بزرگ است (حداکثر {MAX_NUMBER}).")
        return None
    if letter == "C" and value not in GRADES:
        allowed = f"{min(GRADES)} تا {max(GRADES)}"
        errors.append(f"کلاسِ «C{raw}» در سامانه تعریف نشده (فقط {allowed}).")
        return None
    return value


def _read_book(raw: str, errors: list[str]) -> str | None:
    code = raw.lower()
    if code not in BOOKS:
        errors.append(f"کدِ کتابِ «K{raw}» شناخته نشد. کدهای مجاز: {_BOOK_LIST}.")
        return None
    return code


def parse(filename: str) -> ParseResult:
    """`C1-Kr-F1-S2-G2.html` → `GameCode`، یا فهرستِ دقیقِ ایرادها."""
    errors: list[str] = []
    notes: list[str] = []
    # ایرادهای «شکلی» مقصود را مبهم نمی‌کنند؛ با آن‌ها هنوز می‌شود نامِ درست را پیشنهاد داد
    form_only = True

    if filename.endswith(EXTENSION):
        stem = filename[: -len(EXTENSION)]
    else:
        stem, dot, ext = filename.rpartition(".")
        if not dot:
            stem = filename
        errors.append("پسوندِ فایل باید دقیقاً «.html» (با حروفِ کوچک) باشد.")

    if re.search(r"\s", stem):
        # «C1-Kr-F1-S1-G1 copy» تقریباً همیشه کپیِ یک فایلِ دیگر است؛
        # پیشنهادِ نامِ «درست» همان جایگاهِ اصلی را دوبار پر می‌کرد.
        errors.append("نامِ فایل نباید فاصله داشته باشد (شاید کپیِ یک فایلِ دیگر است؟).")
        form_only = False

    translated = stem.translate(_FA_DIGITS)
    if translated != stem:
        errors.append("رقم‌ها باید انگلیسی باشند (2 نه ۲).")
        stem = translated

    if "_" in stem:
        errors.append("بخش‌ها باید با خط‌تیره (-) از هم جدا شوند، نه زیرخط (_).")
    tokens = [token for token in re.split(r"[-_]", stem)]

    found: dict[str, str] = {}
    order: list[str] = []
    unknown: list[str] = []
    for token in tokens:
        if not token:
            errors.append("بینِ دو خط‌تیره چیزی نیست (خط‌تیره‌ی اضافه).")
            continue
        letter, rest = token[0].upper(), token[1:]
        if letter not in PART_LABELS or not rest:
            unknown.append(token)
            continue
        if letter in found:
            # «…-G2-final»: «final» بخشِ دومِ F نیست، یک کلمه‌ی اضافه است
            looks_like_value = rest[:1].isdigit() if letter != "K" else len(rest) == 1
            if looks_like_value:
                errors.append(f"بخشِ {letter} ({PART_LABELS[letter]}) دو بار آمده.")
                form_only = False
            else:
                unknown.append(token)
            continue
        found[letter] = rest
        order.append(letter)

    # نامی که اصلاً شبیهِ قالب نیست یک پیامِ روشن می‌گیرد، نه هشت پیامِ ریز
    if len(found) < 3 or len(unknown) > len(found):
        return ParseResult(None, (f"نامِ فایل با قالبِ «C1-Kr-F1-S1-G1{EXTENSION}» نمی‌خواند.",))

    for token in unknown:
        errors.append(f"بخشِ «{token}» شناخته نشد.")
        form_only = False
    for letter in PARTS:
        if letter not in found:
            errors.append(f"بخشِ {letter} ({PART_LABELS[letter]}) در نام نیست.")
            form_only = False

    values: dict[str, object] = {}
    value_errors: list[str] = []
    for letter, raw in found.items():
        if letter == "K":
            values[letter] = _read_book(raw, value_errors)
        else:
            values[letter] = _read_number(letter, raw, value_errors)
    errors.extend(value_errors)

    complete = len(found) == len(PARTS) and all(v is not None for v in values.values())
    if len(found) == len(PARTS) and tuple(order) != PARTS:
        errors.append("ترتیبِ بخش‌ها باید C-K-F-S-G باشد.")

    code = None
    if complete:
        code = GameCode(
            grade=values["C"], book=values["K"], chapter=values["F"],
            week=values["S"], number=values["G"],
        )

    if errors:
        suggestion = code.filename if code and form_only and not value_errors else None
        return ParseResult(None, tuple(errors), suggestion)

    # معتبر است؛ ولی اگر نوشتنش استاندارد نیست (حروفِ بزرگ/کوچک، صفرِ اول)،
    # یک یادداشت می‌ماند تا فهرستِ فایل‌ها یک‌دست بماند.
    if filename != code.filename:
        notes.append(f"نامِ استاندارد «{code.filename}» است.")
    return ParseResult(code, (), None, tuple(notes))
