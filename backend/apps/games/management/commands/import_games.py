"""
واردکردنِ بازی‌های استودیو به `frontend/public/games`.

    python manage.py import_games ~/Downloads/game --apply

بازی‌ها مستقل ساخته می‌شوند و قراردادِ اپ را نمی‌شناسند. این دستور برای هر
فایلِ با نامِ معتبر:

  - نشانیِ صفحه‌ی «بُرد» را از روی کدِ خودش پیدا می‌کند و در `LUKO_WIN`
    (قطعی) یا `LUKO_WIN_MAYBE` (عمومی، نیازمندِ متنِ بُرد) می‌گذارد؛
  - `luko-sdk.js` (تله‌متری) و `luko-bridge.js` (خبرِ پایان) را می‌افزاید؛
  - وابستگی‌های بیرونی را که روی اینترنتِ کاربر باز نمی‌شوند محلی می‌کند.

فایلِ بی‌نام یا بدنام وارد نمی‌شود و دلیلش گزارش می‌شود؛ `sync_games`
جایگاهشان را از روی همان نام می‌سازد. اجرای دوباره روی فایلِ واردشده هم
امن است: بلوکِ قبلی برداشته و تازه‌اش گذاشته می‌شود.
"""
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.games.naming import parse

# عنصرهایی که «پایانِ بازی» را نشان می‌دهند. الگوها از روی خودِ بازی‌های
# استودیو درآمده‌اند: endGameModal، screen-complete، scr-end، celebration-overlay…
FINAL = re.compile(r"""(game-?complete|game-?finish|game-?done|game-?over|end-?game|
    endgame|end-?overlay|end-?modal|end-?screen|scr-?end|ov-?end|final|victory|congrat|
    celebrat|screen-?complete|complete-?overlay|complete-?modal|modal-?complete|
    win-?screen|reward-?modal)""", re.I | re.X)
LEVEL = re.compile(r"(level-?complete|level-?win|win-?modal|win-?overlay|result)", re.I)
#: رویه‌ی عمومی؛ ممکن است پیامِ باخت هم باشد، پس پل متنش را می‌سنجد
GENERIC = re.compile(r"(overlay|modal|popup|dialog|screen)", re.I)
#: فرزندانِ همان مودال (عنوان، ستاره، سکه، دکمه)، صفحه‌ی خودِ بازی و دکمه‌های کنارش
SKIP = re.compile(r"""(tutorial|guide|help|intro|onboard|menu|pause|setting|confirm|exit|
    shop|store|hint|toast|error|stop|btn|button|title|msg|text|label|desc|summary|content|
    score|stars?$|coin|img|icon|reason|chip|bar|count|
    game-?screen|screen-?game|screen-?home|screen-?menu|screen-?level|screen-?shop|
    screens$|^app$|board|stage|next|restart|again|home|back|resume|start|play)""",
    re.I | re.X)

#: وابستگی‌هایی که روی اینترنتِ کاربرانِ ما باز نمی‌شوند یا اصلاً وجود ندارند
PATCHES = [
    ("https://unpkg.com/three@0.128.0/build/three.module.js",
     "/games/assets/vendor/three.module.js"),
    ("http://localhost:3000/user", "/games/assets/offline"),
    ("http://localhost:3000/api/game", "/games/assets/offline"),
    ("Piano (1).mp3", "piano.mp3"),          # در مخزن فقط piano.mp3 هست
    ("Icons/", "icons/"),                    # حرفِ بزرگ روی لینوکس ۴۰۴ می‌دهد
    # یک بازی روی عنصرِ نبوده می‌افتد و بقیه‌ی آماده‌سازیِ تصویرها را می‌خواباند
    ("  if(ci.complete&&ci.naturalWidth>0)okc();\n"
     "  else{ci.addEventListener('load',okc);ci.addEventListener('error',()=>ci.remove())}",
     "  if(ci){\n"
     "    if(ci.complete&&ci.naturalWidth>0)okc();\n"
     "    else{ci.addEventListener('load',okc);ci.addEventListener('error',()=>ci.remove())}\n"
     "  }"),
]

GOOGLE_FONTS = re.compile(r"<link[^>]+fonts\.googleapis\.com[^>]*>", re.I)

MARK = "<!-- لوکو: تله‌متری و خبرِ پایانِ بازی (به‌صورتِ خودکار افزوده شد) -->"
BLOCK = re.compile(re.escape(MARK) + r".*?luko-bridge\.js\"></script>\s*", re.S)

INJECT = """
{mark}
<script>window.LUKO_WIN = {sure}; window.LUKO_WIN_MAYBE = {maybe};</script>
<script src="/games/assets/luko-sdk.js"></script>
<script src="/games/assets/luko-bridge.js"></script>
"""


def win_hints(text: str) -> tuple[list[str], list[str]]:
    """
    نشانیِ صفحه‌ی پایان: (قطعی، عمومی).

    قطعی یعنی خودِ شناسه می‌گوید پایانِ بازی است؛ عمومی یعنی رویه‌ای که هم
    برای بُرد به‌کار می‌رود هم برای چیزِ دیگر، و پل باید متنش را بسنجد.
    """
    ids = [i for i in dict.fromkeys(re.findall(r'id="([^"]+)"', text)) if not SKIP.search(i)]
    sure = [f"#{i}" for i in ids if FINAL.search(i)]
    sure += [f"#{i}" for i in ids if LEVEL.search(i) and f"#{i}" not in sure]
    maybe = [f"#{i}" for i in ids if GENERIC.search(i) and f"#{i}" not in sure]
    if not sure and not maybe:
        # بازی‌هایی که صفحه را در جاوااسکریپت می‌سازند شناسه‌ی ثابت ندارند
        for group in dict.fromkeys(re.findall(r'class="([^"]+)"', text)):
            for one in group.split():
                if SKIP.search(one):
                    continue
                if FINAL.search(one) or LEVEL.search(one):
                    sure.append("." + one)
                elif GENERIC.search(one):
                    maybe.append("." + one)
    return list(dict.fromkeys(sure))[:5], list(dict.fromkeys(maybe))[:5]


def patch(text: str) -> str:
    for source, target in PATCHES:
        text = text.replace(source, target)
    return GOOGLE_FONTS.sub("<!-- فونتِ گوگل برداشته شد (لوکو) -->", text)


def prepare(text: str) -> str:
    """فایلِ خام (یا واردشده‌ی قبلی) → فایلِ آماده‌ی لوکو."""
    text = BLOCK.sub("", patch(text))
    sure, maybe = win_hints(text)
    block = INJECT.format(mark=MARK, sure=str(sure).replace("'", '"'),
                          maybe=str(maybe).replace("'", '"'))
    if re.search(r"</body\s*>", text, re.I):
        return re.sub(r"</body\s*>", block + "</body>", text, count=1, flags=re.I)
    return text + block


class Command(BaseCommand):
    help = "آوردنِ بازی‌های استودیو با تزریقِ SDK و پلِ پایان"

    def add_arguments(self, parser):
        parser.add_argument("source", help="پوشه‌ی فایل‌های خامِ بازی")
        parser.add_argument("--dest", help="مقصد (پیش‌فرض: GAME_FILES_DIR)")
        parser.add_argument("--apply", action="store_true", help="بنویس (بدونِ آن فقط گزارش)")

    def handle(self, *args, **options):
        source = Path(options["source"]).expanduser()
        dest = Path(options["dest"] or settings.GAME_FILES_DIR)
        if not source.is_dir():
            raise CommandError(f"پوشه پیدا نشد: {source}")

        good, bad, blind = [], [], []
        for path in sorted(source.glob("*.html")):
            result = parse(path.name)
            if not result.ok:
                bad.append((path.name, result.errors))
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            ready = prepare(text)
            sure, maybe = win_hints(text)
            if not sure and not maybe:
                blind.append(path.name)
            good.append((path.name, ready))
            if options["apply"]:
                (dest / path.name).write_text(ready, encoding="utf-8")

        for name, errors in bad:
            self.stdout.write(f"  ✗ {name}  {' / '.join(errors)[:100]}")
        self.stdout.write("")
        self.stdout.write(f"{len(good)} بازیِ آماده · {len(bad)} کنار گذاشته شد")
        if blind:
            self.stdout.write(f"{len(blind)} بازی نشانیِ صفحه‌ی پایان ندارد "
                              "(پل فقط با حدسِ متن کار می‌کند): " + "، ".join(blind))
        if options["apply"]:
            self.stdout.write(self.style.SUCCESS(f"در {dest} نوشته شد — "
                                                 "حالا `manage.py sync_games`"))
        else:
            self.stdout.write(self.style.WARNING("فقط گزارش بود؛ چیزی نوشته نشد."))
