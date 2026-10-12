"""
ساختِ گزارشِ یک بچه برای پنل والدین.

همه‌ی اعداد از داده‌ی واقعی می‌آیند: رویدادهای بازی (apps.games.GameEvent)،
تکمیل‌ها، مأموریت‌های کلاب و ثبت‌حال‌های لوکو سلامت. اگر بچه هنوز داده‌ای
نساخته باشد، ساختارِ خروجی همان می‌ماند و مقدارها صفر می‌شوند تا فرانت
هیچ‌وقت با شکلِ ناقص روبه‌رو نشود.

شکلِ خروجی عمداً برابرِ `features/parent/types.ts` در فرانت است.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, time, timedelta

from django.db.models import Count, Sum
from django.utils import timezone

from apps.common import cache as cache_keys
from apps.common.cache import get_or_set
from apps.club.models import MissionCompletion
from apps.common.fa import fa_date, fa_day, fa_digits, fa_time, to_jalali
from apps.games.models import Book, Game, GameCompletion, GameEvent
from apps.health.models import BreathingSession, MoodCheckin, Painting

from .learning import SESSION_ENDS, build_learning, concept_tags

WEEK_DAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"]

def _label(code: str, tags: dict) -> str:
    """عنوانِ تگِ آموزشی برای والد (جدولِ ConceptTag که تیمِ طراحی پر می‌کند)"""
    tag = tags.get(code)
    return tag.title if tag else code


def _payload(event: GameEvent) -> dict:
    return event.payload if isinstance(event.payload, dict) else {}


def _local(event: GameEvent):
    """زمانِ واقعیِ رویداد در دستگاهِ بچه (رویدادِ آفلاین دیرتر به سرور می‌رسد)"""
    return timezone.localtime(event.occurred_at or event.created_at)


def _day(event: GameEvent):
    return _local(event).date()


def _session_ends(events) -> list[GameEvent]:
    """
    یک ردیف برای هر جلسه. SDK با هر پنهان‌شدنِ صفحه خلاصه‌ی *تجمعیِ* همان جلسه را
    دوباره می‌فرستد؛ بی‌این، زمانِ بازی چند برابر و هر جلسه چند بار در فهرست می‌آمد.
    از هر جلسه آخرین خلاصه (بیشترین مدت) می‌ماند؛ رویدادِ بی‌جلسه (پلِ پایان) خودش یک جلسه است.
    """
    best: dict = {}
    for event in events:
        if event.event_type not in SESSION_ENDS:
            continue
        key = event.session_id or f"#{event.id}"
        current = best.get(key)
        if current is None or (event.duration_ms or 0) >= (current.duration_ms or 0):
            best[key] = event
    return sorted(best.values(), key=lambda e: (e.occurred_at or e.created_at, e.id))


def _minutes(sessions) -> int:
    return round(sum(e.duration_ms or 0 for e in sessions) / 60000)


def _saturday_index(day) -> int:
    """شنبه = ۰ (هفته‌ی ایرانی). weekday(): دوشنبه=۰ … یکشنبه=۶"""
    return (day.weekday() + 2) % 7


def _pct(part: int, total: int) -> int:
    return round(part / total * 100) if total else 0


def build_child_report(child) -> dict:
    """
    گزارشِ کاملِ یک بچه. محاسبه‌اش گران است (همه‌ی رویدادهای هشت هفته)، پس پشتِ
    cache می‌نشیند و با هر بازیِ تازه‌ی بچه صریحاً باطل می‌شود؛ TTL فقط سقفِ ایمنی است.
    """
    return get_or_set(
        cache_keys.parent_report_key(child.id),
        lambda: _build_child_report(child),
        cache_keys.TTL_SHORT,
    )


def invalidate_child_report(child_id: int) -> None:
    """
    بعد از هر رویداد/تکمیلِ بازی صدا زده می‌شود تا نماهای والد کهنه نمانند.
    پیشنهادها هم از همان رویدادها ساخته می‌شوند، پس با هم باطل می‌شوند.
    """
    cache_keys.invalidate(
        cache_keys.parent_report_key(child_id),
        cache_keys.parent_suggestions_key(child_id),
    )


def _build_child_report(child) -> dict:
    now = timezone.localtime()
    today = now.date()
    week_start = today - timedelta(days=6)
    eight_weeks_ago = today - timedelta(weeks=8)
    since = timezone.make_aware(datetime.combine(eight_weeks_ago, time.min))

    events = list(
        GameEvent.objects.filter(user=child, occurred_at__gte=since).order_by("occurred_at", "id")
    )
    answers = [e for e in events if e.event_type == "answer"]
    sessions = _session_ends(events)
    tags = concept_tags()

    completions = list(GameCompletion.objects.filter(user=child))
    # همه‌ی ردیف‌ها برای پیدا کردنِ عنوانِ تاریخچه (حتی بازیِ حذف‌شده)؛
    # ولی «از چند بازی» و «بازی‌های هنوز باز نشده» فقط از مسیرِ کلاسِ خودِ بچه
    games_meta = {g.slug: g for g in Game.objects.all()}
    catalog = {g.slug: g for g in Game.objects.playable().filter(grade=child.grade)}
    books = {b.book_id: b for b in Book.objects.all()}

    week_answers = [e for e in answers if _day(e) >= week_start]

    return {
        "childId": str(child.id),
        # پاسخ‌های همین هفته — تحلیلِ هفتگی روی همین بسته می‌شود، نه روی کلِ هشت هفته
        "answersThisWeek": len(week_answers),
        "kpis": _kpis(child, events, answers, sessions, completions, week_start, today),
        "week": _week(events, sessions, completions, week_start, today),
        "accuracyTrend": _accuracy_trend(answers, today),
        "subjects": _subjects(answers, completions, games_meta, catalog, books, tags),
        "games": _games(events, sessions, completions, games_meta, catalog, books),
        "moods": _moods(child),
        "insights": _insights(answers, events, games_meta, tags),
        "wellbeing": _wellbeing(child),
        "hourly": _hourly(events),
        "sessions": _sessions(sessions, games_meta),
        "topics": _topics(answers, tags),
        # تگ‌های آموزشی: زمانِ بازی، خطای هر مفهوم و موفقیت در اولین تلاش
        "learning": build_learning(child),
    }


# ---------------------------------------------------------------- KPIها
def _kpis(child, events, answers, sessions, completions, week_start, today) -> list[dict]:
    prev_start = week_start - timedelta(days=7)
    week_sessions = [e for e in sessions if _day(e) >= week_start]
    prev_sessions = [e for e in sessions if prev_start <= _day(e) < week_start]
    week_minutes, prev_minutes = _minutes(week_sessions), _minutes(prev_sessions)
    week_answers = [e for e in answers if _day(e) >= week_start]
    prev_answers = [e for e in answers if prev_start <= _day(e) < week_start]
    week_correct = sum(1 for e in week_answers if e.is_correct)
    prev_correct = sum(1 for e in prev_answers if e.is_correct)

    week_games = [c for c in completions if timezone.localdate(c.created_at) >= week_start]
    prev_games = [c for c in completions if prev_start <= timezone.localdate(c.created_at) < week_start]
    week_coins = sum(c.coins_awarded for c in week_games)
    prev_coins = sum(c.coins_awarded for c in prev_games)

    avg_session = round(
        sum(e.duration_ms or 0 for e in week_sessions) / 60000 / len(week_sessions)
    ) if week_sessions else 0

    def delta(current: float, previous: float) -> int:
        if not previous:
            return 100 if current else 0
        return round((current - previous) / previous * 100)

    return [
        {"key": "time", "label": "زمان یادگیری این هفته", "value": week_minutes, "unit": "دقیقه",
         "delta": delta(week_minutes, prev_minutes), "higherIsBetter": True,
         "hint": "مجموع زمانِ فعالِ بازی‌ها در هفت روز گذشته"},
        {"key": "games", "label": "بازی کامل‌شده", "value": len(week_games), "unit": "بازی",
         "delta": delta(len(week_games), len(prev_games)), "higherIsBetter": True},
        {"key": "accuracy", "label": "میانگین دقت پاسخ‌ها",
         "value": _pct(week_correct, len(week_answers)), "unit": "٪",
         "delta": _pct(week_correct, len(week_answers)) - _pct(prev_correct, len(prev_answers)),
         "higherIsBetter": True},
        {"key": "streak", "label": "روزهای پیاپی", "value": _streak(child), "unit": "روز",
         "delta": 0, "higherIsBetter": True},
        {"key": "session", "label": "میانگین هر جلسه", "value": avg_session, "unit": "دقیقه",
         "delta": 0, "higherIsBetter": True,
         "hint": "جلسه‌های خیلی کوتاه می‌تواند نشانهٔ خستگی یا حواس‌پرتی باشد"},
        {"key": "coins", "label": "سکهٔ این هفته", "value": week_coins, "unit": "سکه",
         "delta": delta(week_coins, prev_coins), "higherIsBetter": True},
    ]


def _streak(child) -> int:
    """روزهای پیاپیِ فعالیت (بازی یا مأموریت) تا امروز."""
    days = set(
        GameCompletion.objects.filter(user=child)
        .values_list("created_at__date", flat=True)
    ) | set(MissionCompletion.objects.filter(user=child).values_list("day", flat=True))
    if not days:
        return 0
    today = timezone.localdate()
    streak, cursor = 0, today
    if cursor not in days:
        cursor -= timedelta(days=1)          # شاید امروز هنوز بازی نکرده
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


# ---------------------------------------------------------------- نمودارها
def _week(events, sessions, completions, week_start, today) -> list[dict]:
    by_day_ms: dict = defaultdict(int)
    by_day_games: dict = defaultdict(int)
    for event in sessions:
        day = _day(event)
        if day >= week_start:
            by_day_ms[day] += event.duration_ms or 0
    for completion in completions:
        day = timezone.localdate(completion.created_at)
        if day >= week_start:
            by_day_games[day] += 1

    out = []
    for offset in range(7):
        day = week_start + timedelta(days=offset)
        out.append({
            "day": WEEK_DAYS[_saturday_index(day)],
            "minutes": round(by_day_ms.get(day, 0) / 60000),
            "games": by_day_games.get(day, 0),
        })
    return out


def _accuracy_trend(answers, today) -> list[dict]:
    """
    دقت هر هفته در هشت هفته‌ی گذشته.

    `samples` تعدادِ پاسخ‌های همان هفته است؛ فرانت با آن «هفته‌ی بدونِ داده» را از
    «هفته‌ی صفر درصد» جدا می‌کند تا نمودار، افتِ ساختگی نشان ندهد.
    """
    out = []
    for week_no in range(7, -1, -1):
        start = today - timedelta(weeks=week_no + 1)
        end = today - timedelta(weeks=week_no)
        bucket = [e for e in answers if start < _day(e) <= end]
        correct = sum(1 for e in bucket if e.is_correct)
        out.append({
            "label": f"هفتهٔ {fa_digits(8 - week_no)}",
            "value": _pct(correct, len(bucket)),
            "samples": len(bucket),
        })
    return out


# ---------------------------------------------------------------- درس‌ها و بازی‌ها
def _subject_of(slug: str, games_meta: dict, books: dict) -> str:
    game = games_meta.get(slug)
    book = books.get(game.book_id) if game else None
    return book.subject if book else "عمومی"


def _subjects(answers, completions, games_meta, catalog, books, tags) -> list[dict]:
    """
    تسلط بر حسبِ درسِ کتاب (ریاضی، علوم، …) — همان چیزی که والد می‌فهمد.
    اگر بازی برای هر پاسخ `topic` بفرستد، همان topicها هم به‌عنوان ریزنمره
    داخل همان درس جمع می‌شوند تا دقت واقعی‌تر باشد.
    """
    stats: dict = defaultdict(lambda: {"asked": 0, "correct": 0, "topics": defaultdict(lambda: [0, 0])})
    for event in answers:
        subject = _subject_of(event.game_slug, games_meta, books)
        bucket = stats[subject]
        bucket["asked"] += 1
        is_correct = 1 if event.is_correct else 0
        bucket["correct"] += is_correct
        if event.concept_tag in tags:
            bucket["topics"][event.concept_tag][0] += 1
            bucket["topics"][event.concept_tag][1] += is_correct

    done_by_subject: dict = defaultdict(set)
    for completion in completions:
        done_by_subject[_subject_of(completion.game_slug, games_meta, books)].add(
            completion.game_slug
        )
    total_by_subject: dict = defaultdict(int)
    for game in catalog.values():
        book = books.get(game.book_id)
        total_by_subject[book.subject if book else "عمومی"] += 1

    out = []
    for subject in set(stats) | set(done_by_subject) | set(total_by_subject):
        bucket = stats.get(subject)
        mastery = _pct(bucket["correct"], bucket["asked"]) if bucket else 0
        weakest = ""
        if bucket and bucket["topics"]:
            topic, (asked, correct) = min(
                bucket["topics"].items(), key=lambda item: item[1][1] / max(item[1][0], 1)
            )
            if _pct(correct, asked) < 70:
                weakest = _label(topic, tags)
        out.append({
            "key": subject,
            "label": subject,
            "mastery": mastery,
            "gamesDone": len(done_by_subject.get(subject, ())),
            "gamesTotal": total_by_subject.get(subject, 0),
            # درسی که هنوز پاسخی ندارد نه رو به رشد است نه رو به افت
            "trend": ("flat" if not bucket
                      else "up" if mastery >= 70
                      else "flat" if mastery >= 50 else "down"),
            "weakestTopic": weakest,      # فرانت می‌تواند بعداً نشانش دهد
        })
    return sorted(out, key=lambda item: -item["mastery"])


def _games(events, sessions, completions, games_meta, catalog, books) -> list[dict]:
    by_slug: dict = defaultdict(lambda: {
        "starts": 0, "answers": 0, "correct": 0, "hints": 0,
        "ms": 0, "sessions": 0, "best": 0, "last": None,
    })
    for event in events:
        bucket = by_slug[event.game_slug]
        if event.event_type == "game_start":
            bucket["starts"] += 1
        elif event.event_type == "answer":
            bucket["answers"] += 1
            bucket["correct"] += 1 if event.is_correct else 0
        elif event.event_type == "hint":
            bucket["hints"] += 1
        bucket["last"] = event.occurred_at or event.created_at
    for event in sessions:                       # هر جلسه یک‌بار
        bucket = by_slug[event.game_slug]
        bucket["sessions"] += 1
        bucket["ms"] += event.duration_ms or 0
        bucket["best"] = max(bucket["best"], _payload(event).get("accuracy", 0) or 0)

    coins_by_slug: dict = defaultdict(int)
    for completion in completions:
        coins_by_slug[completion.game_slug] += completion.coins_awarded

    out = []
    for slug, bucket in by_slug.items():
        game = games_meta.get(slug)
        book = books.get(game.book_id) if game else None
        accuracy = _pct(bucket["correct"], bucket["answers"])
        if bucket["answers"] == 0:
            status = "untouched"
        elif accuracy >= 85 and bucket["hints"] == 0:
            status = "mastered"
        elif accuracy < 60:
            status = "struggling"
        else:
            status = "progress"
        out.append({
            "id": slug,
            "title": game.title if game else slug,
            "subject": book.subject if book else "عمومی",
            "subjectLabel": book.subject if book else "عمومی",
            "book": book.title if book else "—",
            "attempts": bucket["starts"],
            "bestScore": bucket["best"] or accuracy,
            "accuracy": accuracy,
            "avgSeconds": round(bucket["ms"] / 1000 / bucket["sessions"]) if bucket["sessions"] else 0,
            "totalMinutes": round(bucket["ms"] / 60000),
            "hints": bucket["hints"],
            "lastPlayedAt": fa_date(timezone.localtime(bucket["last"]).date()) if bucket["last"] else "—",
            "coins": coins_by_slug.get(slug, 0),
            "status": status,
        })

    # بازی‌هایی که اصلاً باز نشده‌اند هم دیده شوند
    for slug, game in catalog.items():
        if slug in by_slug:
            continue
        book = books.get(game.book_id)
        out.append({
            "id": slug, "title": game.title,
            "subject": book.subject if book else "عمومی",
            "subjectLabel": book.subject if book else "عمومی",
            "book": book.title if book else "—",
            "attempts": 0, "bestScore": 0, "accuracy": 0, "avgSeconds": 0,
            "totalMinutes": 0, "hints": 0, "lastPlayedAt": "—", "coins": 0,
            "status": "untouched",
        })
    return out


# ---------------------------------------------------------------- سلامت
def _moods(child) -> list[dict]:
    entries = (
        MoodCheckin.objects.filter(user=child).order_by("-created_at")[:14]
    )
    return [
        {"day": fa_digits(to_jalali(timezone.localtime(e.created_at).date())[2]), "mood": e.mood}
        for e in reversed(list(entries))
    ]


def _wellbeing(child) -> dict:
    two_weeks = timezone.localdate() - timedelta(days=14)
    checkins = MoodCheckin.objects.filter(user=child, created_at__date__gte=two_weeks)
    dominant = (
        checkins.values("mood").annotate(n=Count("mood")).order_by("-n").first()
    )
    return {
        "checkins": checkins.count(),
        "breathingSessions": BreathingSession.objects.filter(
            user=child, created_at__date__gte=two_weeks).count(),
        "paintings": Painting.objects.filter(
            user=child, created_at__date__gte=two_weeks).count(),
        "dominantMood": dominant["mood"] if dominant else "calm",
    }


# ---------------------------------------------------------------- بینش‌ها
def _insights(answers, events, games_meta, tags) -> list[dict]:
    """
    بینش‌های قاعده‌محور از دادهٔ واقعی. جای مدلِ زبانی را بعداً همین‌جا می‌گیرد؛
    تا آن‌وقت هیچ جمله‌ای ساخته نمی‌شود که پشتش عدد نباشد.
    """
    if not answers:
        return [{
            "id": "empty", "tone": "tip", "title": "هنوز داده‌ای نداریم",
            "body": "به‌محض اینکه فرزندتان چند بازی انجام دهد، تحلیل اینجا ساخته می‌شود.",
        }]

    out = []
    by_topic: dict = defaultdict(lambda: {"asked": 0, "correct": 0})
    by_game: dict = defaultdict(lambda: {"asked": 0, "correct": 0, "hints": 0})
    for event in answers:
        # فقط تگِ ثبت‌شده؛ قبلاً پاسخِ بی‌مبحث با شناسه‌ی خامِ بازی («g-1a2b…») در عنوان می‌آمد
        if event.concept_tag in tags:
            by_topic[event.concept_tag]["asked"] += 1
            by_topic[event.concept_tag]["correct"] += 1 if event.is_correct else 0
        by_game[event.game_slug]["asked"] += 1
        by_game[event.game_slug]["correct"] += 1 if event.is_correct else 0
    for event in events:
        if event.event_type == "hint":
            by_game[event.game_slug]["hints"] += 1

    ranked = sorted(
        ((k, _pct(v["correct"], v["asked"]), v["asked"]) for k, v in by_topic.items() if v["asked"] >= 2),
        key=lambda item: -item[1],
    )
    # فقط وقتی تعریف می‌کنیم که واقعاً خوب باشد؛ تعریفِ بی‌جا گزارش را بی‌ارزش می‌کند
    if ranked and ranked[0][1] >= 70:
        key, accuracy, asked = ranked[0]
        out.append({
            "id": "best", "tone": "good",
            "title": f"{_label(key, tags)} را خوب گرفته",
            "body": f"از {fa_digits(asked)} پاسخ در این مبحث، {fa_digits(accuracy)}٪ درست بوده است.",
        })
    if ranked and ranked[-1][1] < 70:
        key, accuracy, asked = ranked[-1]
        out.append({
            "id": "weak", "tone": "watch",
            "title": f"{_label(key, tags)} نقطهٔ گیر است",
            "body": f"دقت در این مبحث {fa_digits(accuracy)}٪ است ({fa_digits(asked)} پاسخ)؛ کمی تمرین بیشتر کمک می‌کند.",
        })

    hinted = sorted(by_game.items(), key=lambda item: -item[1]["hints"])
    if hinted and hinted[0][1]["hints"] >= 3:
        slug, bucket = hinted[0]
        game = games_meta.get(slug)
        out.append({
            "id": "hints", "tone": "tip",
            "title": f"در «{game.title if game else slug}» زیاد راهنمایی گرفته",
            "body": f"{fa_digits(bucket['hints'])} بار راهنمایی خواسته است — یعنی مفهوم را کامل نگرفته، نه اینکه بی‌دقت باشد.",
        })
    return out or [{
        "id": "steady", "tone": "good", "title": "روند یکنواخت است",
        "body": "داده‌ها نوسان خاصی نشان نمی‌دهند؛ ادامهٔ همین روال خوب است.",
    }]


# ---------------------------------------------------------------- تحلیل‌های ریزتر
def _hourly(events) -> list[dict]:
    """
    بچه در چه ساعت‌هایی بازی می‌کند — برای والد مهم است بداند بازی‌ها
    نزدیکِ خواب انجام می‌شود یا بعدازظهر.
    """
    buckets = [0] * 24
    for event in events:
        if event.event_type in {"game_start", "answer"}:
            buckets[_local(event).hour] += 1
    peak = max(buckets) if any(buckets) else 0
    return [{"hour": hour, "count": count,
             "intensity": round(count / peak * 100) if peak else 0}
            for hour, count in enumerate(buckets)]


def _sessions(sessions, games_meta) -> list[dict]:
    """آخرین جلسه‌های بازی (هر جلسه یک ردیف): کِی، چقدر، با چه دقتی."""
    out = []
    for event in reversed(sessions):
        payload = _payload(event)
        game = games_meta.get(event.game_slug)
        local = _local(event)
        out.append({
            "id": event.id,
            "game": game.title if game else event.game_slug,
            "at": fa_day(local.date(), timezone.localdate()),
            "time": fa_time(local),
            "minutes": round((event.duration_ms or 0) / 60000),
            "accuracy": payload.get("accuracy", 0),
            "stars": payload.get("stars"),
        })
        if len(out) >= 12:
            break
    return out


def _topics(answers, tags) -> list[dict]:
    """ریزنمره‌ی تگ‌های آموزشی — پایه‌ی «نقطه‌ی قوت و ضعف». فقط تگ‌های ثبت‌شده."""
    stats: dict = defaultdict(lambda: {"asked": 0, "correct": 0, "ms": 0})
    for event in answers:
        if event.concept_tag not in tags:
            continue
        bucket = stats[event.concept_tag]
        bucket["asked"] += 1
        bucket["correct"] += 1 if event.is_correct else 0
        bucket["ms"] += event.time_taken_ms or 0
    out = [{
        "key": key,
        "label": _label(key, tags),
        "asked": value["asked"],
        "accuracy": _pct(value["correct"], value["asked"]),
        "avgSeconds": round(value["ms"] / value["asked"] / 1000) if value["asked"] else 0,
    } for key, value in stats.items()]
    return sorted(out, key=lambda item: -item["accuracy"])
