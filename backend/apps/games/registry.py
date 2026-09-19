"""
رجیستریِ بازی‌ها: از فایل‌های روی دیسک تا ردیف‌های `Game`.

بازیِ تازه فقط یک فایل با نامِ درست است (قالب در `naming.py`)؛ هیچ کدی
دستی عوض نمی‌شود. سه مرحله، هر کدام جدا و تست‌پذیر:

    scan(root)          فایل‌ها را پیدا می‌کند و می‌خواند          (بی‌دیتابیس)
    plan(files, known)  هر فایل کدام بازی است و کجا می‌نشیند        (بی‌دیتابیس)
    apply(plan)         همان تصمیم را در یک تراکنش می‌نویسد

**هویت از نام جداست.** پیشرفتِ بچه‌ها به slug بسته است، پس فایلی که تغییرِ
نام می‌دهد — مثلاً G3 که G4 می‌شود تا جا برای بازیِ تازه باز شود — باید همان
بازی بماند؛ وگرنه تکمیلِ «G3ِ قدیم» به بازیِ تازه‌ای که حالا G3 است می‌چسبید.
تطبیق به این ترتیب است:

    ۱. همان مسیر، همان محتوا          → همان بازی
    ۲. همان محتوا، مسیرِ تازه          → تغییرِ نام (جابه‌جایی)
    ۳. همان مسیر، محتوای تازه          → ویرایشِ همان بازی
    ۴. هیچ‌کدام                       → بازیِ تازه

**فایلِ مشکل‌دار هیچ‌وقت حدسی جا نمی‌گیرد.** نامِ نامعتبر «نامعتبر» می‌ماند و
دو فایل در یک جایگاه «تکراری»؛ اگر یکی از آن دو از قبل همان‌جا بوده، او
می‌ماند و تازه‌وارد کنار می‌رود — افزودنِ یک فایلِ غلط بازیِ سالمِ قبلی را از
مسیر بیرون نمی‌اندازد.
"""
from __future__ import annotations

import hashlib
import html
import re
import secrets
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from .naming import BOOKS, GameCode, ParseResult, parse

# وضعیت‌ها — همان مقادیرِ `Game.Status`
READY = "ready"
INVALID = "invalid"
CONFLICT = "conflict"
MISSING = "missing"

#: پوشه‌هایی از ریشه‌ی بازی‌ها که بازی نیستند
SKIP_DIRS = frozenset({"assets"})

#: عنوانِ پیش‌فرض وقتی فایل `<title>` ندارد
FALLBACK_TITLE = "بازیِ تازه"

TITLE_MAX = 120

#: واژه‌هایی که در عنوانِ بچه‌ها نباید باشند (درس، پایه، …). نامِ کتاب‌ها
#: خودکار از `BOOKS` اضافه می‌شود. فقط هشدار است، مانعِ جاگرفتن نیست.
HINT_WORDS = (
    "فارسی", "درس", "درسی", "پایه", "کلاس", "آموزش", "آموزشی", "تمرین",
    "تفریق", "ضرب", "تقسیم",
)

#: نگهبانِ ایمنی: اگر بیش از این سهم از بازی‌های مسیر یک‌جا «ناپدید» شوند،
#: به‌احتمالِ زیاد پوشه اشتباه است یا آپلود نیمه‌کاره مانده — اعمال نمی‌شود.
MASS_REMOVAL_SHARE = 0.5
MASS_REMOVAL_MIN = 3


# --------------------------------------------------------------------- scan
@dataclass(frozen=True)
class GameFile:
    """یک فایلِ بازی روی دیسک."""

    path: str        # آدرسی که nginx سرو می‌کند: `/games/C1-Kr-F1-S1-G1.html`
    name: str
    digest: str      # sha256ِ محتوا — برای تشخیصِ تغییرِ نام
    title: str       # از `<title>`، پاک‌شده؛ '' یعنی نداشت
    parsed: ParseResult


_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_TITLE_SPLIT = re.compile(r"\s+[-–—|:]\s+|\s*\|\s*")
_BRAND = re.compile(r"^(?:luko|loko)\b.*$", re.IGNORECASE)
_LEADING_GAME = re.compile(r"^بازی(?:ِ|‌ی)?\s+")
# نشانه‌هایی که بخشی از حرف نیستند: گزینشگرِ گونه (ایموجی)، ZWJ، keycap
_INVISIBLE = {0x200D, 0x20E3} | set(range(0xFE00, 0xFE10))


def clean_title(raw: str) -> str:
    """
    `<title>`ِ بازی → عنوانِ مناسبِ بچه.

    «سفر ریتم - LOKO UI» → «سفر ریتم»،  «🎮 بازی اعداد لوکو» → «اعداد لوکو»،
    «کارخانه خوراکی‌ها - علوم پایه اول» → «کارخانه خوراکی‌ها».
    """
    text = html.unescape(raw)
    text = "".join(
        ch for ch in text
        if ord(ch) not in _INVISIBLE and unicodedata.category(ch) not in {"So", "Cs", "Co", "Cn"}
    )
    text = re.sub(r"\s+", " ", text).strip()
    for part in _TITLE_SPLIT.split(text):
        part = part.strip()
        if part and not _BRAND.match(part):
            text = part
            break
    else:
        return ""
    text = _LEADING_GAME.sub("", text).strip()
    return text[:TITLE_MAX]


def read_title(content: bytes) -> str:
    match = _TITLE_RE.search(content.decode("utf-8", errors="replace"))
    return clean_title(match.group(1)) if match else ""


def scan(root: Path, url_prefix: str = "/games") -> list[GameFile]:
    """
    همه‌ی فایل‌های HTMLِ زیرِ ریشه، به ترتیبِ ثابت.

    پوشه نقشی در جایگاه ندارد — فقط نامِ فایل. `assets/` و پوشه‌هایی که با
    `_` یا `.` شروع می‌شوند (مثلِ `_reference`) بازی نیستند.
    """
    files: list[GameFile] = []
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if any(part.startswith(("_", ".")) for part in rel.parts):
            continue
        if rel.parts[0] in SKIP_DIRS:
            continue
        if not path.is_file() or path.suffix.lower() not in {".html", ".htm"}:
            continue
        content = path.read_bytes()
        files.append(GameFile(
            path=f"{url_prefix}/{rel.as_posix()}",
            name=path.name,
            digest=hashlib.sha256(content).hexdigest(),
            title=read_title(content),
            parsed=parse(path.name),
        ))
    return files


# --------------------------------------------------------------------- plan
@dataclass(frozen=True)
class Known:
    """آنچه برنامه‌ریز از یک ردیفِ موجود لازم دارد."""

    slug: str
    path: str
    digest: str
    status: str
    #: جایگاهِ فعلی — فقط اگر همین حالا روی مسیر است
    slot: tuple[int, int, int, int] | None = None
    title: str = ""
    #: تاریخچه دارد (تکمیل، رویداد، بازیِ روز)؟ ردیفِ بی‌تاریخچه پاک‌شدنی است.
    referenced: bool = False


@dataclass
class Entry:
    """تصمیمِ برنامه‌ریز برای یک فایل."""

    file: GameFile
    previous: Known | None
    #: same | renamed | edited | new
    match: str
    status: str = READY
    problems: list[str] = field(default_factory=list)
    season_order: int = 0
    book_order: int = 0

    @property
    def code(self) -> GameCode | None:
        return self.file.parsed.code if self.status != INVALID else None

    @property
    def slug(self) -> str | None:
        return self.previous.slug if self.previous else None

    @property
    def title(self) -> str:
        """عنوانی که بچه می‌بیند: عنوانِ ثبت‌شده، وگرنه عنوانِ خودِ فایل."""
        if self.previous and self.previous.title:
            return self.previous.title
        return self.file.title or FALLBACK_TITLE


@dataclass
class Plan:
    entries: list[Entry]
    #: ردیف‌هایی که فایلشان دیگر نیست
    gone: list[Known]
    warnings: list[str]
    #: اگر پر باشد، اعمال نمی‌شود (نگهبانِ ایمنی)
    blocked: str = ""

    def by_status(self, status: str) -> list[Entry]:
        return [e for e in self.entries if e.status == status]

    @property
    def ready(self) -> list[Entry]:
        return sorted(self.by_status(READY), key=lambda e: e.code.slot)

    @property
    def removed(self) -> list[Known]:
        """بازی‌هایی که تا همین حالا روی مسیر بودند و فایلشان رفته."""
        return [k for k in self.gone if k.status != MISSING]


def _match(files: list[GameFile], known: list[Known]) -> tuple[list[Entry], list[Known]]:
    """هویتِ هر فایل (کدام ردیفِ موجود، یا تازه). ترتیبِ مراحل در توضیحِ ماژول است."""
    unclaimed: dict[str, Known] = {k.slug: k for k in sorted(known, key=lambda k: k.slug)}
    by_path: dict[str, list[Known]] = defaultdict(list)
    for row in unclaimed.values():
        by_path[row.path].append(row)
    entries: list[Entry] = []

    def take(file: GameFile, row: Known, how: str) -> None:
        entries.append(Entry(file=file, previous=row, match=how))
        del unclaimed[row.slug]

    def at_path(file: GameFile, accept) -> Known | None:
        return next((k for k in by_path.get(file.path, ())
                     if k.slug in unclaimed and accept(k)), None)

    # ۱. همان مسیر و همان محتوا. ردیفِ قدیمیِ بی‌اثرانگشت هم با مسیر شناخته می‌شود.
    pending = []
    for file in files:
        row = at_path(file, lambda k: k.digest in ("", file.digest))
        if row:
            take(file, row, "same")
        else:
            pending.append(file)

    # ۲. همان محتوا در مسیرِ تازه — فقط وقتی بی‌ابهام است (یک فایل، یک ردیف)
    files_by_digest: dict[str, list[GameFile]] = defaultdict(list)
    for file in pending:
        files_by_digest[file.digest].append(file)
    rows_by_digest: dict[str, list[Known]] = defaultdict(list)
    for row in unclaimed.values():
        if row.digest:
            rows_by_digest[row.digest].append(row)
    rest = []
    for file in pending:
        rows = rows_by_digest.get(file.digest, [])
        if len(rows) == 1 and len(files_by_digest[file.digest]) == 1:
            take(file, rows[0], "renamed")
        else:
            rest.append(file)

    # ۳. همان مسیر با محتوای تازه. ردیفِ «حذف‌شده» این‌جا زنده نمی‌شود: فایلِ
    #    تازه‌ای که بعدها جای فایلِ پاک‌شده می‌نشیند بازیِ دیگری است و نباید
    #    تکمیل‌های آن را به ارث ببرد.
    fresh = []
    for file in rest:
        row = at_path(file, lambda k: k.status != MISSING)
        if row:
            take(file, row, "edited")
        else:
            fresh.append(file)

    # ۴. تازه
    entries.extend(Entry(file=file, previous=None, match="new") for file in fresh)
    return entries, list(unclaimed.values())


def _place(entries: list[Entry]) -> None:
    """اعتبار، جایگاه و ترتیب."""
    for entry in entries:
        parsed = entry.file.parsed
        if not parsed.ok:
            entry.status = INVALID
            entry.problems = list(parsed.errors)
            if parsed.suggestion:
                entry.problems.append(f"نامِ درست: {parsed.suggestion}")

    by_slot: dict[tuple, list[Entry]] = defaultdict(list)
    for entry in entries:
        if entry.status != INVALID:
            by_slot[entry.code.slot].append(entry)

    for slot, group in by_slot.items():
        if len(group) == 1:
            continue
        label = group[0].code.slot_label
        incumbents = [e for e in group
                      if e.previous and e.previous.status == READY and e.previous.slot == slot]
        if len(incumbents) == 1:
            keeper = incumbents[0]
            for entry in group:
                if entry is not keeper:
                    entry.status = CONFLICT
                    entry.problems.append(
                        f"جایگاهِ {label} را از قبل «{keeper.file.name}» گرفته است؛ "
                        "شماره‌ی G (یا هفته/فصل) این فایل را عوض کن."
                    )
        else:
            names = "، ".join(e.file.name for e in group)
            for entry in group:
                entry.status = CONFLICT
                entry.problems.append(
                    f"چند فایل یک جایگاه ({label}) دارند: {names}. "
                    "در هر هفته هر شماره‌ی G فقط یک‌بار (بینِ همه‌ی کتاب‌ها)."
                )

    ready = sorted((e for e in entries if e.status == READY), key=lambda e: e.code.slot)
    per_grade: dict[int, int] = defaultdict(int)
    per_book: dict[str, int] = defaultdict(int)
    for entry in ready:
        per_grade[entry.code.grade] += 1
        per_book[entry.code.book_id] += 1
        entry.season_order = per_grade[entry.code.grade]
        entry.book_order = per_book[entry.code.book_id]


def _hint_pattern() -> re.Pattern:
    words = sorted({*HINT_WORDS, *(b.name for b in BOOKS.values())}, key=len, reverse=True)
    body = "|".join(map(re.escape, words))
    return re.compile(rf"(?<![\w‌])(?:{body})(?:‌?ی|‌?ها)?(?![\w‌])")


_HINTS = _hint_pattern()


def title_hint(title: str) -> str | None:
    """واژه‌ی آموزشیِ داخلِ عنوان، اگر باشد."""
    match = _HINTS.search(title or "")
    return match.group(0) if match else None


def _warnings(entries: list[Entry]) -> list[str]:
    out: list[str] = []
    ready = sorted((e for e in entries if e.status == READY), key=lambda e: e.code.slot)

    for entry in ready:
        out.extend(f"{entry.file.name}: {note}" for note in entry.file.parsed.notes)

    books_in_grade: dict[int, set[str]] = defaultdict(set)
    weeks: dict[tuple, list[Entry]] = defaultdict(list)
    chapters: dict[tuple, set[int]] = defaultdict(set)
    for entry in ready:
        code = entry.code
        books_in_grade[code.grade].add(code.book)
        weeks[(code.grade, code.chapter, code.week)].append(entry)
        chapters[(code.grade, code.chapter)].add(code.week)

    for (grade, chapter), week_numbers in chapters.items():
        gaps = sorted(set(range(1, max(week_numbers) + 1)) - week_numbers)
        if gaps:
            out.append(f"C{grade}-F{chapter}: هفته‌ی "
                       + "، ".join(f"S{n}" for n in gaps) + " بازی ندارد (شماره‌ها پیوسته نیستند).")

    for (grade, chapter, week), group in weeks.items():
        where = f"C{grade}-F{chapter}-S{week}"
        numbers = {e.code.number for e in group}
        gaps = sorted(set(range(1, max(numbers) + 1)) - numbers)
        if gaps:
            out.append(f"{where}: " + "، ".join(f"G{n}" for n in gaps)
                       + " نیست (شماره‌ها پیوسته نیستند).")
        # قاعده: در هر هفته دست‌کم یک بازی از هر کتابی که این کلاس دارد
        missing = sorted(books_in_grade[grade] - {e.code.book for e in group})
        if missing and len(books_in_grade[grade]) > 1:
            out.append(f"{where}: از " + "، ".join(f"K{m} ({BOOKS[m].name})" for m in missing)
                       + " بازی ندارد.")

    for entry in ready:
        if entry.previous is None and not entry.file.title:
            out.append(f"{entry.file.name}: فایل <title> ندارد؛ عنوانِ «{FALLBACK_TITLE}» "
                       "گذاشته شد — از پنلِ ادمین عوضش کن.")
        hint = title_hint(entry.title)
        if hint:
            out.append(f"{entry.file.name}: عنوانِ «{entry.title}» واژه‌ی «{hint}» دارد "
                       "و به بچه درس را لو می‌دهد.")

    same_content: dict[str, list[str]] = defaultdict(list)
    for entry in entries:
        same_content[entry.file.digest].append(entry.file.name)
    for names in same_content.values():
        if len(names) > 1:
            out.append("این فایل‌ها محتوای یکسان دارند: " + "، ".join(sorted(names)))
    return out


def plan(files: list[GameFile], known: list[Known], *, allow_mass_removal: bool = False) -> Plan:
    entries, gone = _match(files, known)
    _place(entries)
    result = Plan(entries=entries, gone=gone, warnings=_warnings(entries))

    if not files:
        result.blocked = "هیچ فایلِ بازی‌ای پیدا نشد؛ مسیرِ پوشه درست است؟"
        return result
    live = [k for k in known if k.status == READY]
    lost = [k for k in result.removed if k.status == READY]
    if (not allow_mass_removal and len(lost) >= MASS_REMOVAL_MIN
            and len(lost) > len(live) * MASS_REMOVAL_SHARE):
        result.blocked = (
            f"{len(lost)} بازی از {len(live)} بازیِ مسیر یک‌جا ناپدید می‌شوند. "
            "احتمالاً پوشه اشتباه است یا آپلود نیمه‌کاره مانده؛ چیزی عوض نشد. "
            "اگر عمدی است با --allow-mass-removal دوباره اجرا کن."
        )
    return result


# ------------------------------------------------------------------- report
_MATCH_FA = {"renamed": "تغییرِ نام", "edited": "ویرایش", "new": "تازه"}


def render(result: Plan) -> str:
    """گزارشِ فارسیِ یک برنامه — برای خروجیِ دستور و پیامِ ادمین."""
    lines: list[str] = []
    ready = result.ready
    by_grade: dict[int, list[Entry]] = defaultdict(list)
    for entry in ready:
        by_grade[entry.code.grade].append(entry)

    for grade, group in sorted(by_grade.items()):
        lines.append(f"کلاسِ {grade} — {len(group)} بازی روی مسیر")
        week_index = 0
        last = None
        for entry in group:
            code = entry.code
            if (code.chapter, code.week) != last:
                last = (code.chapter, code.week)
                week_index += 1
                lines.append(f"  هفته‌ی {week_index}  (F{code.chapter}-S{code.week})")
            tag = f"  [{_MATCH_FA[entry.match]}]" if entry.match in _MATCH_FA else ""
            lines.append(f"    {entry.season_order:>3}. {code}  {entry.title}{tag}")

    trouble = result.by_status(INVALID) + result.by_status(CONFLICT)
    if trouble:
        lines.append("")
        lines.append(f"نیاز به بررسی — {len(trouble)} فایل (روی مسیر نیامدند):")
        for entry in trouble:
            kind = "نامعتبر" if entry.status == INVALID else "جایگاهِ تکراری"
            lines.append(f"  ✗ {entry.file.path}  ({kind})")
            lines.extend(f"      - {problem}" for problem in entry.problems)

    if result.removed:
        lines.append("")
        lines.append("فایلشان دیگر نیست:")
        lines.extend(f"  - {k.path}  ({k.title or k.slug})" for k in result.removed)

    if result.warnings:
        lines.append("")
        lines.append(f"هشدارها ({len(result.warnings)}) — مانعِ کار نیستند:")
        lines.extend(f"  ! {warning}" for warning in result.warnings)

    lines.append("")
    lines.append(summary(result))
    if result.blocked:
        lines.append(f"اعمال نشد: {result.blocked}")
    return "\n".join(lines)


def summary(result: Plan) -> str:
    counts = defaultdict(int)
    for entry in result.entries:
        counts[entry.status] += 1
        if entry.status == READY and entry.match in _MATCH_FA:
            counts[entry.match] += 1
    return (
        f"روی مسیر {counts[READY]} · نامعتبر {counts[INVALID]} · تکراری {counts[CONFLICT]} · "
        f"تازه {counts['new']} · تغییرِ نام {counts['renamed']} · ویرایش {counts['edited']} · "
        f"حذف {len(result.removed)}"
    )


# -------------------------------------------------------------------- apply
LOCK_KEY = "games:registry:lock"


class SyncBusy(Exception):
    """همگام‌سازیِ دیگری همین حالا در جریان است."""


def known_rows() -> list[Known]:
    from apps.parent.models import DailyAssignment

    from .models import Game, GameCompletion, GameEvent

    referenced = set(GameCompletion.objects.values_list("game_slug", flat=True))
    referenced |= set(GameEvent.objects.order_by().values_list("game_slug", flat=True).distinct())
    referenced |= set(DailyAssignment.objects.values_list("game_slug", flat=True))
    rows = []
    for game in Game.objects.all():
        placed = game.status == READY and game.chapter and game.week and game.number
        rows.append(Known(
            slug=game.slug,
            path=game.game_file,
            digest=game.content_hash,
            status=game.status,
            slot=(game.grade, game.chapter, game.week, game.number) if placed else None,
            title=game.title,
            referenced=game.slug in referenced,
        ))
    return rows


def _new_slug(taken: set[str]) -> str:
    """شناسه‌ی بی‌معنا و پایدار. معنادار نیست تا در آدرس چیزی از درس پیدا نباشد."""
    from .models import GameCompletion

    while True:
        slug = f"g-{secrets.token_hex(4)}"
        if slug not in taken and not GameCompletion.objects.filter(game_slug=slug).exists():
            taken.add(slug)
            return slug


def _ensure_books(codes: list[GameCode]) -> None:
    """کتابِ هر (کلاس، K) اگر نیست ساخته می‌شود؛ کتابِ موجود دست نمی‌خورد."""
    from apps.common.constants import GRADE_CHOICES

    from .models import Book

    grade_names = dict(GRADE_CHOICES)
    existing = set(Book.objects.values_list("book_id", flat=True))
    for code in codes:
        if code.book_id in existing:
            continue
        book = BOOKS[code.book]
        Book.objects.create(
            book_id=code.book_id,
            title=f"{book.name} {grade_names.get(code.grade, code.grade)}",
            subject=book.name,
            grade=code.grade,
            sort=list(BOOKS).index(code.book),
        )
        existing.add(code.book_id)


def apply(result: Plan) -> None:
    """
    برنامه را در یک تراکنش می‌نویسد. برنامه‌ی مسدود هیچ‌وقت اعمال نمی‌شود.
    نوشتن دسته‌ای است (نه یکی‌یکی) تا هزاران فایل هم در یک درخواستِ ادمین جا شود.
    """
    from django.db import transaction
    from django.utils import timezone

    from .models import Game

    if result.blocked:
        raise ValueError(result.blocked)

    now = timezone.now()
    with transaction.atomic():
        rows = {g.slug: g for g in Game.objects.select_for_update()}
        taken = set(rows)
        created: list[Game] = []
        changed: dict[str, Game] = {}
        changed_fields: set[str] = set()
        for entry in result.entries:
            fields = {
                "game_file": entry.file.path,
                "content_hash": entry.file.digest,
                "status": entry.status,
                "review_note": "\n".join(entry.problems),
                "season_order": entry.season_order,
                "order": entry.book_order,
            }
            code = entry.file.parsed.code
            if code and entry.status != INVALID:
                fields.update(grade=code.grade, book_code=code.book, chapter=code.chapter,
                              week=code.week, number=code.number, book_id=code.book_id)
            else:
                fields.update(book_code="", chapter=0, week=0, number=0)

            if entry.slug is None:
                created.append(Game(slug=_new_slug(taken), title=entry.title, **fields))
                continue
            game = rows[entry.slug]
            if not game.title:
                fields["title"] = entry.title
            for name, value in fields.items():
                if getattr(game, name) != value:
                    setattr(game, name, value)
                    changed[game.slug] = game
                    changed_fields.add(name)

        Game.objects.bulk_create(created, batch_size=500)
        if changed:
            for game in changed.values():
                game.updated_at = now
            Game.objects.bulk_update(list(changed.values()),
                                     [*sorted(changed_fields), "updated_at"], batch_size=500)

        forget = [row.slug for row in result.gone if not row.referenced]
        # بی‌تاریخچه — نگه‌داشتنش فقط فهرستِ ادمین را شلوغ می‌کند
        Game.objects.filter(slug__in=forget).delete()
        Game.objects.filter(
            slug__in=[row.slug for row in result.gone if row.referenced and row.status != MISSING]
        ).update(
            status=MISSING, season_order=0, updated_at=now,
            review_note="فایلِ این بازی دیگر نیست؛ تاریخچه‌اش نگه داشته شده.",
        )

        _ensure_books([e.code for e in result.entries if e.status == READY])
    drop_caches()


def drop_caches() -> None:
    """کشِ کاتالوگ و مسیرِ همه‌ی کلاس‌ها."""
    from apps.common import cache
    from apps.common.constants import GRADE_CHOICES

    grades = [str(value) for value, _ in GRADE_CHOICES]
    cache.invalidate(
        cache.book_catalog_key(None),
        *(cache.book_catalog_key(g) for g in grades),
        *(cache.game_path_key(g) for g in grades),
    )


def sync(root: Path, *, dry_run: bool = False, allow_mass_removal: bool = False) -> Plan:
    """
    اسکن → برنامه → (اگر dry_run نباشد و مسدود نباشد) اعمال.

    پوشه‌ای که وجود ندارد هیچ‌وقت یعنی «همه‌ی بازی‌ها حذف شدند»؛ خطاست.
    قفل پیش از خواندنِ ردیف‌ها گرفته می‌شود: برنامه‌ای که پیش از اعمالِ
    همگام‌سازیِ دیگری حساب شده باشد، فایلِ تازه را دوباره «تازه» می‌بیند و
    برایش ردیفِ دوم می‌سازد.
    """
    from django.core.cache import cache as django_cache

    if not root.is_dir():
        raise FileNotFoundError(f"پوشه‌ی بازی‌ها پیدا نشد: {root}")
    if dry_run:
        return plan(scan(root), known_rows(), allow_mass_removal=allow_mass_removal)
    if not django_cache.add(LOCK_KEY, 1, 300):
        raise SyncBusy("همگام‌سازیِ دیگری همین حالا در جریان است.")
    try:
        result = plan(scan(root), known_rows(), allow_mass_removal=allow_mass_removal)
        if not result.blocked:
            apply(result)
    finally:
        django_cache.delete(LOCK_KEY)
    return result
