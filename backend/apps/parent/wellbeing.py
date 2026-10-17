"""
صفحه‌ی «سلامت» در پنلِ والد — دو بخش:

- weekly («حالِ کلیِ هفته»، برای همه): یک حکمِ ساده (عالی / خوب / متغیر / نیاز به توجه) از
  ثبت‌های حالِ هفت روزِ اخیر، ترکیبِ حال‌ها، فعالیت‌های آرامش و یکی دو پیشنهاد. وارد جزئیات نمی‌شود.
- daily («حالِ دقیقِ روزانه»، فقط با اشتراک — gating.py): سفرِ حالِ هر روز، حال در بخش‌های روز،
  حال بعد از هر درس، حال و یادگیری، علاقه‌ها و پیشنهادهای بیشتر و دقیق‌تر.

حال‌ها: شاد و آرام «خوب»، خسته «کم‌انرژی»، ناراحت و عصبانی «سخت». هیچ جمله‌ای بی‌عددِ واقعی
ساخته نمی‌شود؛ وقتی نمونه کم است، آن تحلیل اصلاً گفته نمی‌شود.
"""
from __future__ import annotations

from bisect import bisect_right
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta

from django.utils import timezone

from apps.club.synced import sport_count
from apps.common.fa import fa_date, fa_day, fa_digits, fa_time, to_jalali
from apps.content.models import PodcastListen, VideoInteraction
from apps.health.models import BreathingSession, MoodCheckin, Painting

from .weekly import period_label

MOODS = ("happy", "calm", "tired", "sad", "angry")
GOOD = {"happy", "calm"}
HARD = {"sad", "angry"}
MOOD_FA = {"happy": "شاد", "calm": "آرام", "tired": "خسته", "sad": "ناراحت", "angry": "عصبانی"}

#: بخش‌های روز به وقتِ تهران: (کلید، نام، از ساعتِ، تا ساعتِ)
PARTS = (
    ("morning", "صبح", 6, 11),
    ("noon", "ظهر", 11, 14),
    ("afternoon", "عصر", 14, 18),
    ("evening", "شب", 18, 21),
    ("late", "آخرِ شب", 21, 6),
)
WEEKDAYS = ("دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه", "یک‌شنبه")

WEEK_DAYS = 7
JOURNEY_DAYS = 7
#: تحلیلِ دقیق روی چهار هفته‌ی اخیر؛ یک هفته برای «بخش‌های روز» و «درس‌ها» نمونه‌ی کمی دارد
DETAIL_DAYS = 28
#: بازیِ تا یک ساعت پیش از ثبتِ حال، آن حال را «بعد از آن درس» می‌کند
AFTER_WINDOW = timedelta(minutes=60)
#: پاسخ‌های تا ۴۵ دقیقه بعد از ثبتِ حال با همان حال سنجیده می‌شوند
LEARN_WINDOW = timedelta(minutes=45)
MIN_PART = 3          # ثبتِ حال برای این‌که یک بخشِ روز تحلیل شود
MIN_SUBJECT = 2       # ثبتِ حال بعد از یک درس
MIN_LEARN = 8         # پاسخ در هر گروهِ «حالِ خوب / حالِ کم»
LIFT = 15             # فاصله‌ی معنادار از میانگین (درصد)
MAX_ENTRIES = 16      # ثبتِ حال در سفرِ یک روز

#: رنگ‌های جعبه‌مدادِ نقاشی (frontend/src/features/health/paintingData.ts)
COLOR_FA = {
    "#e5484d": "قرمز", "#f2994a": "نارنجی", "#f2c230": "زرد", "#2e9e5b": "سبز",
    "#4696e5": "آبی", "#8f6bc9": "بنفش", "#e56fa7": "صورتی", "#1d2128": "مشکی",
}
#: دسته‌ی پادکست و ویدیو → نامِ علاقه
THEME_FA = {"قصه": "قصه‌ها", "علمی": "علم و کشف", "موسیقی": "موسیقی", "خواب": "قصه‌های خواب",
            "کارتون": "کارتون"}


def _pct(part: int, total: int) -> int:
    return round(part / total * 100) if total else 0


def _good(moods) -> int:
    moods = list(moods)
    return _pct(sum(1 for m in moods if m in GOOD), len(moods))


def _dominant(moods) -> str | None:
    counts = Counter(moods)
    # هم‌تعداد: ترتیبِ MOODS (خوب‌ها جلوتر) تصمیم می‌گیرد تا خروجی ثابت بماند
    return max(MOODS, key=lambda m: (counts[m], -MOODS.index(m))) if counts else None


def _part_of(hour: int) -> str:
    for key, _, start, end in PARTS:
        if (start <= hour < end) if start < end else (hour >= start or hour < end):
            return key
    return "late"


def _tip(id_: str, kind: str, title: str, body: str) -> dict:
    return {"id": id_, "kind": kind, "title": title, "body": body}


# ---------------------------------------------------------------- حالِ کلیِ هفته
def _verdict(moods: list[str]) -> str:
    if not moods:
        return "none"
    good = _good(moods)
    hard = _pct(sum(1 for m in moods if m in HARD), len(moods))
    tired = _pct(sum(1 for m in moods if m == "tired"), len(moods))
    if hard >= 40 or hard + tired >= 60:
        return "attention"
    if good >= 75 and hard <= 10:
        return "great"
    if good >= 55:
        return "good"
    return "mixed"


VERDICT_FA = {"great": "عالی", "good": "خوب", "mixed": "متغیر", "attention": "نیاز به توجه",
              "none": "هنوز ثبت نشده"}


def _weekly_tips(verdict: str, moods: list[str], breathing: int, name: str) -> list[dict]:
    low = _dominant([m for m in moods if m not in GOOD])
    tips: list[dict] = []
    if verdict == "none":
        return [
            _tip("w-checkin", "mood", "بپرسید امروز حالش چطور است",
                 f"در لوکو هر نیم‌ساعت از {name} می‌پرسیم حالش چطور است. اگر شما هم شب‌ها بپرسید، "
                 "گفتنِ حال برایش عادت می‌شود."),
            _tip("w-paint", "art", "با هم یک نقاشی بکشید",
                 "بخشِ نقاشیِ لوکو سلامت جای خوبی برای گفتنِ حال بی‌کلمه است؛ رنگ‌ها خیلی چیزها را می‌گویند."),
        ]
    if low == "sad" and verdict in ("attention", "mixed"):
        tips.append(_tip("w-talk", "together", "چند دقیقه فقط با او حرف بزنید",
                         "بی‌سؤالِ درسی بپرسید امروز چه چیزی خوشحالش کرد و چه چیزی نه؛ فقط گوش بدهید."))
    elif low == "angry" and verdict in ("attention", "mixed"):
        tips.append(_tip("w-breath", "breath", "تنفسِ ۴-۴-۴ را با هم امتحان کنید",
                         "وقتی عصبانی است، چهار ثانیه دم، چهار ثانیه نگه‌داشتن و چهار ثانیه بازدم آرامش می‌کند. "
                         "در بخشِ لوکو سلامت هست."))
    elif low == "tired" and verdict in ("attention", "mixed"):
        tips.append(_tip("w-sleep", "sleep", "خواب و استراحتش را جدی بگیرید",
                         "خستگیِ زیاد بیشتر از کم‌خوابی می‌آید؛ ساعتِ خوابِ ثابت و بازیِ کوتاه‌تر در شب کمک می‌کند."))
    if verdict in ("great", "good"):
        tips.append(_tip("w-praise", "praise", "حالِ خوبش را به رویش بیاورید",
                         f"به {name} بگویید که این هفته شاد و آرام بوده و از او بپرسید چه چیزی حالش را خوب کرده."))
    if len(tips) < 2:
        if breathing == 0 and verdict != "great":
            tips.append(_tip("w-calm", "breath", "یک عادتِ آرامشِ کوتاه",
                             "روزی یک تمرینِ تنفسِ یک‌دقیقه‌ای در لوکو سلامت، کنارِ شما، تمرینِ خوبی برای آرام‌شدن است."))
        else:
            tips.append(_tip("w-routine", "routine", "روالِ روزانه را ثابت نگه دارید",
                             "خواب، غذا و بازی در ساعت‌های ثابت، حالِ بچه‌ها را هم ثابت‌تر می‌کند."))
    return tips[:2]


def _weekly(name: str, week: list, prev: list, breathing: int, paintings: int, last, today: date,
            week_start: date) -> dict:
    moods = [c.mood for c in week]
    verdict = _verdict(moods)
    n = len(moods)
    good_n = sum(1 for m in moods if m in GOOD)
    dominant = _dominant(moods)
    trend = None
    if n >= 3 and len(prev) >= 3:
        diff = _good(moods) - _good(c.mood for c in prev)
        trend = "up" if diff >= LIFT else "down" if diff <= -LIFT else "flat"

    if verdict == "none":
        title = f"این هفته حالی از {name} ثبت نشده"
        body = (f"آخرین بار {fa_day(timezone.localdate(last.created_at), today)} گفت «{MOOD_FA[last.mood]}» است."
                if last else f"{name} هنوز حالش را در لوکو ثبت نکرده است.")
    elif verdict == "great":
        title = f"{name} این هفته حالِ خیلی خوبی داشت"
        body = f"از {fa_digits(n)} باری که حالش را گفت، {fa_digits(good_n)} بار شاد یا آرام بود."
    elif verdict == "good":
        title = f"حالِ {name} این هفته خوب بود"
        body = f"بیشترِ وقت‌ها «{MOOD_FA[dominant]}» بود؛ {fa_digits(good_n)} بار از {fa_digits(n)} بار حالش خوب بود."
    elif verdict == "mixed":
        title = f"حالِ {name} این هفته بالا و پایین داشت"
        body = f"{fa_digits(good_n)} بار از {fa_digits(n)} بار حالش خوب بود و بقیه‌ی وقت‌ها بیشتر «{MOOD_FA[_dominant([m for m in moods if m not in GOOD])]}»."
    else:
        low = _dominant([m for m in moods if m not in GOOD])
        title = f"{name} این هفته بیشتر «{MOOD_FA[low]}» بود"
        body = f"{fa_digits(n - good_n)} بار از {fa_digits(n)} بار حالِ خوبی نداشت. کمی بیشتر کنارش باشید؛ پیشنهادها کمک می‌کند."
    if trend == "up":
        body += " حالش بهتر از هفته‌ی پیش بود."
    elif trend == "down":
        body += " کمی پایین‌تر از هفته‌ی پیش بود."

    counts = Counter(moods)
    return {
        "period": period_label(week_start, today),
        "verdict": verdict,
        "label": VERDICT_FA[verdict],
        "title": title,
        "body": body,
        "dominant": dominant,
        "trend": trend,
        "mix": [{"mood": m, "count": counts[m]} for m in MOODS if counts[m]],
        "stats": {"checkins": n, "breathing": breathing, "paintings": paintings},
        "tips": _weekly_tips(verdict, moods, breathing, name),
    }


# ---------------------------------------------------------------- حالِ دقیقِ روزانه
class _Timeline:
    """زمان‌های مرتب برای جست‌وجوی «آخرین چیزی که پیش از این لحظه بود»."""

    def __init__(self, items: list[tuple[datetime, str]]):
        items.sort(key=lambda item: item[0])
        self.times = [t for t, _ in items]
        self.values = [v for _, v in items]

    def before(self, at: datetime, window: timedelta) -> str | None:
        i = bisect_right(self.times, at) - 1
        return self.values[i] if i >= 0 and at - self.times[i] <= window else None


def _journey(checkins: list, played: _Timeline, today: date) -> list[dict]:
    by_day = defaultdict(list)
    for c in checkins:
        by_day[timezone.localtime(c.created_at).date()].append(c)
    days = []
    for offset in range(JOURNEY_DAYS - 1, -1, -1):
        day = today - timedelta(days=offset)
        rows = sorted(by_day.get(day, []), key=lambda c: c.created_at)
        if len(rows) > MAX_ENTRIES:            # روزِ پُر: یکی در میان، ولی اولی و آخری بمانند
            step = len(rows) / MAX_ENTRIES
            rows = [rows[round(i * step)] for i in range(MAX_ENTRIES - 1)] + [rows[-1]]
        label = "امروز" if offset == 0 else "دیروز" if offset == 1 else WEEKDAYS[day.weekday()]
        days.append({
            "date": day.isoformat(),
            "label": label,
            "short": fa_digits(to_jalali(day)[2]),
            "entries": [{"time": fa_time(timezone.localtime(c.created_at)), "mood": c.mood,
                         "after": played.before(c.created_at, AFTER_WINDOW)} for c in rows],
            "dominant": _dominant(c.mood for c in by_day.get(day, [])),
            "count": len(by_day.get(day, [])),
        })
    return days


def _parts(checkins: list) -> list[dict]:
    by_part = defaultdict(list)
    for c in checkins:
        by_part[_part_of(timezone.localtime(c.created_at).hour)].append(c.mood)
    out = []
    for key, label, start, end in PARTS:
        moods = by_part.get(key, [])
        enough = len(moods) >= MIN_PART
        out.append({
            "key": key, "label": label, "range": f"{fa_digits(start)} تا {fa_digits(end)}",
            "count": len(moods), "good": _pct(sum(1 for m in moods if m in GOOD), len(moods)),
            "dominant": _dominant(moods), "enough": enough,
        })
    ranked = [p for p in out if p["enough"]]
    if len(ranked) >= 2:
        best = max(ranked, key=lambda p: p["good"])
        worst = min(ranked, key=lambda p: p["good"])
        if best["good"] - worst["good"] >= LIFT:
            best["tag"], worst["tag"] = "best", "worst"
    return out


def _subjects(checkins: list, played: _Timeline, baseline: int) -> list[dict]:
    by_subject = defaultdict(list)
    for c in checkins:
        subject = played.before(c.created_at, AFTER_WINDOW)
        if subject:
            by_subject[subject].append(c.mood)
    rows = [{
        "subject": subject, "count": len(moods), "good": _good(moods), "dominant": _dominant(moods),
        "lift": _good(moods) - baseline,
    } for subject, moods in by_subject.items() if len(moods) >= MIN_SUBJECT]
    return sorted(rows, key=lambda r: (-r["good"], -r["count"]))


def _learning(checkins: list, answers: list) -> dict | None:
    moods = _Timeline([(c.created_at, c.mood) for c in checkins])
    groups = {"good": [0, 0], "low": [0, 0]}
    for event in answers:
        mood = moods.before(event.occurred_at or event.created_at, LEARN_WINDOW)
        if mood is None or event.is_correct is None:
            continue
        group = groups["good" if mood in GOOD else "low"]
        group[0] += 1
        group[1] += 1 if event.is_correct else 0
    if groups["good"][0] < MIN_LEARN or groups["low"][0] < MIN_LEARN:
        return None
    return {key: {"answers": n, "accuracy": _pct(ok, n)} for key, (n, ok) in groups.items()}


def _favorite_color(paintings: list) -> dict | None:
    total = Counter()
    for p in paintings:
        if isinstance(p.colors, dict):
            for hex_, n in p.colors.items():
                if isinstance(n, (int, float)) and str(hex_).lower() in COLOR_FA:
                    total[str(hex_).lower()] += n
    if not total:
        return None
    hex_, _ = total.most_common(1)[0]
    return {"color": hex_, "label": COLOR_FA[hex_]}


def _interests(child, since: datetime, sessions: list, subject_of, paintings: list, breathing: int) -> list[dict]:
    """چیزهایی که خودش سراغشان می‌رود — هر کدام با عددِ پشتش؛ مرتب با یک امتیازِ ساده."""
    found: list[tuple[float, dict]] = []

    minutes = defaultdict(int)
    count = defaultdict(int)
    for e in sessions:
        subject = subject_of(e.game_slug)
        if subject and subject != "عمومی":
            minutes[subject] += round((e.duration_ms or 0) / 60000)
            count[subject] += 1
    for subject, m in sorted(minutes.items(), key=lambda kv: -kv[1])[:2]:
        if m >= 10:
            found.append((m / 10, {"key": f"subject:{subject}", "kind": "subject", "label": subject,
                                   "detail": f"{fa_digits(m)} دقیقه در {fa_digits(count[subject])} جلسه"}))

    themes: dict = defaultdict(lambda: {"listens": 0, "likes": 0})
    for category in PodcastListen.objects.filter(user=child, created_at__gte=since) \
            .values_list("podcast__category", flat=True):
        themes[category]["listens"] += 1
    for category in VideoInteraction.objects.filter(user=child, liked=True) \
            .values_list("video__category", flat=True):
        themes[category]["likes"] += 1
    for category, t in themes.items():
        if t["listens"] + t["likes"] < 2:
            continue
        parts = []
        if t["listens"]:
            parts.append(f"{fa_digits(t['listens'])} بار پادکستش را گوش داد")
        if t["likes"]:
            parts.append(f"{fa_digits(t['likes'])} ویدیو را پسندید")
        found.append((t["listens"] * 1.5 + t["likes"], {
            "key": f"theme:{category}", "kind": "story" if category in ("قصه", "خواب") else
            "music" if category == "موسیقی" else "science" if category == "علمی" else "video",
            "label": THEME_FA.get(category, category), "detail": " و ".join(parts)}))

    if len(paintings) >= 2:
        color = _favorite_color(paintings)
        detail = f"{fa_digits(len(paintings))} نقاشی کشید"
        if color:
            detail += f"؛ رنگِ محبوبش {color['label']}"
        found.append((len(paintings) * 1.5, {"key": "art", "kind": "art", "label": "نقاشی", "detail": detail}))

    sport = sport_count(child, timezone.localtime(since).date())
    if sport >= 2:
        found.append((sport * 1.5, {"key": "sport", "kind": "sport", "label": "ورزش و تحرک",
                                    "detail": f"{fa_digits(sport)} مأموریتِ ورزشی انجام داد"}))
    if breathing >= 2:
        found.append((breathing, {"key": "calm", "kind": "calm", "label": "تمرین‌های آرامش",
                                  "detail": f"{fa_digits(breathing)} بار تمرینِ تنفس کرد"}))
    return [item for _, item in sorted(found, key=lambda pair: -pair[0])][:4]


def _daily_tips(name: str, parts: list, subjects: list, learning: dict | None, interests: list,
                moods: list[str], breathing: int) -> list[dict]:
    tips: list[dict] = []
    worst = next((p for p in parts if p.get("tag") == "worst"), None)
    best = next((p for p in parts if p.get("tag") == "best"), None)
    if worst:
        mood = MOOD_FA.get(worst["dominant"] or "", "کم‌حوصله")
        tips.append(_tip(f"d-part-{worst['key']}", "routine", f"{worst['label']}\u200cها بیشتر «{mood}» است",
                         f"فقط {fa_digits(worst['good'])}٪ ثبت‌های {worst['label']} خوب بوده‌اند. بازی و تمرین را از "
                         f"{worst['label']} به {best['label'] if best else 'ساعتِ دیگری'} ببرید و آن وقت را برای استراحت بگذارید."))
    if best:
        tips.append(_tip(f"d-best-{best['key']}", "goal", f"{best['label']}\u200cها بهترین وقتِ یادگیری است",
                         f"{fa_digits(best['good'])}٪ ثبت‌های {best['label']} شاد یا آرام بوده‌اند؛ تمرینِ درس‌های سخت‌تر را "
                         f"همان وقت بگذارید."))
    up = next((s for s in subjects if s["lift"] >= LIFT), None)
    down = next((s for s in reversed(subjects) if s["lift"] <= -LIFT), None)
    if up:
        tips.append(_tip(f"d-up-{up['subject']}", "praise", f"«{up['subject']}» حالش را بهتر می‌کند",
                         f"بعد از بازی‌های {up['subject']}، {fa_digits(up['good'])}٪ وقت‌ها شاد یا آرام بوده است. "
                         f"روزهای بی‌حوصلگی را با یک بازیِ {up['subject']} شروع کنید."))
    if down:
        mood = MOOD_FA.get(down["dominant"] or "", "کم‌حوصله")
        tips.append(_tip(f"d-down-{down['subject']}", "practice", f"بعد از «{down['subject']}» بیشتر «{mood}» است",
                         f"جلسه‌های {down['subject']} را کوتاه‌تر کنید و بعدش یک استراحتِ کوچک یا بازیِ مورد علاقه‌اش بگذارید."))
    if learning and learning["good"]["accuracy"] - learning["low"]["accuracy"] >= 10:
        tips.append(_tip("d-learn", "mood", "با حالِ خوب بهتر یاد می‌گیرد",
                         f"وقتی شاد یا آرام است {fa_digits(learning['good']['accuracy'])}٪ پاسخ‌هایش درست است و وقتی نه، "
                         f"{fa_digits(learning['low']['accuracy'])}٪. پیش از تمرین، چند دقیقه حالش را خوب کنید."))
    if interests:
        # علاقه‌ی غیرِدرسی گویاتر است؛ درسِ محبوب معمولاً همان «حالش را بهتر می‌کند» است
        top = next((i for i in interests if i["kind"] != "subject"), interests[0])
        tips.append(_tip(f"d-like-{top['key']}", "together", f"از «{top['label']}» پلی بسازید",
                         f"{name} به {top['label']} علاقه دارد ({top['detail']}). از همین علاقه برای حرف‌زدن، "
                         "تشویق و حتی جایزه‌ی کارهای سخت‌تر استفاده کنید."))
    hard = sum(1 for m in moods if m in HARD)
    if hard >= 2 and breathing == 0:
        tips.append(_tip("d-breath", "breath", "تنفسِ ۴-۴-۴ را یادش بدهید",
                         f"{fa_digits(hard)} بار ناراحت یا عصبانی بوده و هنوز تمرینِ تنفس نکرده؛ یک بار کنارش انجامش دهید."))
    if len(tips) < 3:
        tips.append(_tip("d-ask", "mood", "بعد از هر بازی بپرسید چه حسی داشت",
                         "این‌طوری خودش هم یاد می‌گیرد حالش را بشناسد و بگوید؛ ثبت‌های بیشتر، تحلیلِ دقیق‌تر."))
    if len(tips) < 3:
        tips.append(_tip("d-routine", "routine", "روالِ ثابت، حالِ ثابت",
                         "خواب، غذا و بازی در ساعت‌های ثابت، بالا و پایینِ حال را کمتر می‌کند."))
    return tips[:5]


# ---------------------------------------------------------------- ورودی
def build_health(child, *, name: str, answers: list, sessions: list, subject_of, today: date) -> dict:
    """
    `answers` و `sessions` همان رویدادهای گزارشِ والدند (services._build_child_report).
    خروجی: {weekly, daily}؛ daily برای بی‌اشتراک در gating.py با {locked, teaser} عوض می‌شود.
    """
    week_start = today - timedelta(days=WEEK_DAYS - 1)
    detail_start = today - timedelta(days=DETAIL_DAYS - 1)
    since = timezone.make_aware(datetime.combine(min(detail_start, week_start - timedelta(days=7)), time.min))
    checkins = list(MoodCheckin.objects.filter(user=child, created_at__gte=since).order_by("created_at"))
    day_of = lambda c: timezone.localtime(c.created_at).date()  # noqa: E731

    week = [c for c in checkins if day_of(c) >= week_start]
    prev = [c for c in checkins if week_start - timedelta(days=7) <= day_of(c) < week_start]
    detail = [c for c in checkins if day_of(c) >= detail_start]
    detail_since = timezone.make_aware(datetime.combine(detail_start, time.min))
    week_since = timezone.make_aware(datetime.combine(week_start, time.min))
    breathing = list(BreathingSession.objects.filter(user=child, created_at__gte=detail_since)
                     .values_list("created_at", flat=True))
    paintings = list(Painting.objects.filter(user=child, created_at__gte=detail_since).only("colors", "created_at"))
    last = None if week else MoodCheckin.objects.filter(user=child).order_by("-created_at").first()

    weekly = _weekly(name, week, prev, sum(1 for t in breathing if t >= week_since),
                     sum(1 for p in paintings if p.created_at >= week_since), last, today, week_start)

    played = _Timeline([(e.occurred_at or e.created_at, subject_of(e.game_slug))
                        for e in [*answers, *sessions] if subject_of(e.game_slug) != "عمومی"])
    moods = [c.mood for c in detail]
    baseline = _good(moods)
    parts = _parts(detail)
    subjects = _subjects(detail, played, baseline)
    detail_answers = [e for e in answers if timezone.localtime(e.occurred_at or e.created_at).date() >= detail_start]
    learning = _learning(detail, detail_answers)
    detail_sessions = [e for e in sessions if timezone.localtime(e.occurred_at or e.created_at).date() >= detail_start]
    interests = _interests(child, detail_since, detail_sessions, subject_of, paintings, len(breathing))
    return {
        "weekly": weekly,
        "daily": {
            "range": f"{fa_date(detail_start)} تا {fa_date(today)}",
            "checkins": len(detail),
            "baseline": baseline,
            "journey": _journey([c for c in detail if day_of(c) > today - timedelta(days=JOURNEY_DAYS)],
                                played, today),
            "parts": parts,
            "subjects": subjects,
            "learning": learning,
            "interests": interests,
            "favoriteColor": _favorite_color(paintings),
            "tips": _daily_tips(name, parts, subjects, learning, interests, moods, len(breathing)),
        },
    }


def health_teaser(daily: dict) -> dict:
    """پیش‌نمایشِ بی‌اشتراک: فقط اندازه‌ی تحلیل، نه خودش"""
    return {
        "locked": True,
        "teaser": {
            "checkins": daily.get("checkins", 0),
            "parts": sum(1 for p in daily.get("parts", []) if p.get("count")),
            "subjects": len(daily.get("subjects", [])),
            "interests": len(daily.get("interests", [])),
            "tips": len(daily.get("tips", [])),
        },
    }
