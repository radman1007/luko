"""
«رشدِ چهار هفته» برای صفحه‌ی دستیارِ هوشمند: چهار بُعد، هفته‌به‌هفته، همه از داده‌ی واقعی.

- ریاضی و مهارت‌های زبانی (فارسی و نگارش): «پیشرفت در کتاب» — چند درصد از بازی‌های کلاسِ بچه در آن درس
  تا پایانِ هر هفته تمام شده. بیشترِ بازی‌ها هنوز پاسخ‌به‌پاسخ نمی‌فرستند و ستاره‌ی همه‌شان ۳ است (پروداکشن،
  ۲۴ مهر ۱۴۰۵)؛ پس تنها سنجه‌ای که برای همه‌ی بچه‌ها معنا دارد همین پیشرفت است. هر جا پاسخ ثبت شده، دقت کنارش.
- تمرکز و توجه: سهمِ جلسه‌هایی که تا آخر رفته (نه نیمه‌کاره) × سهمِ زمانِ فعال در برابرِ زمان‌های بی‌حرکت
  (رویدادِ idle) — فقط برای هفته‌ای که دست‌کم MIN_SESSIONS جلسه دارد.
- حالِ خوب: سهمِ «شاد» و «آرام» از ثبت‌های حالِ همان هفته (دست‌کم MIN_CHECKINS ثبت).

دو نسخه ساخته می‌شود (پشتِ کشِ گزارش): کامل، و رایگان که زبان و حال را قفل می‌کند و متن‌هایش هم فقط از
بُعدهای باز می‌گوید (gating.FREE_VARIANTS). متن‌ها قاعده‌محورند؛ تحلیلِ هوشمند (apps/ai) اگر برسد جایشان
می‌نشیند و عددها همین‌جا می‌مانند.
"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.common.fa import fa_date, fa_digits

WEEKS = 4
MIN_SESSIONS = 3
MIN_CHECKINS = 2
MIN_ANSWERS = 5
GOOD_MOODS = {"happy", "calm"}
LATE_HOURS = {21, 22, 23, 0, 1, 2, 3, 4, 5}

#: (کلید، برچسب، درس‌ها) — درس همان برچسبِ کتاب است (Book.subject)
SUBJECT_DIMS = (
    ("math", "ریاضی", ("ریاضی",)),
    ("language", "مهارت‌های زبانی", ("فارسی", "نگارش")),
)
LABELS = {"math": "ریاضی", "language": "مهارت‌های زبانی", "focus": "تمرکز و توجه", "mood": "حالِ خوب"}
#: بی‌اشتراک فقط ریاضی باز است (gating.FREE_SUBJECTS)؛ تمرکز از همه‌ی جلسه‌هاست، مثلِ زمانِ بازیِ هفته
FREE_LOCKED = ("language", "mood")

HOW = {
    "math": "چند درصد از بازی‌های ریاضیِ کلاسش تا پایانِ هر هفته تمام شده",
    "language": "چند درصد از بازی‌های فارسی و نگارشِ کلاسش تا پایانِ هر هفته تمام شده",
    "focus": "بازی‌هایی که تا آخر رفته، در کنارِ زمانِ فعال در برابرِ زمان‌هایی که بازی بی‌حرکت مانده",
    "mood": "سهمِ «شاد» و «آرام» از حال‌هایی که خودش در لوکو ثبت کرده",
}


def _pct(part: float, total: float) -> int:
    return round(part / total * 100) if total else 0


def _n(value) -> str:
    return fa_digits(value)


def _local_day(event):
    return timezone.localtime(event.occurred_at or event.created_at).date()


def week_bounds(today) -> list[tuple]:
    """چهار بازه‌ی هفت‌روزه، قدیمی‌ترین اول؛ آخری به امروز ختم می‌شود"""
    out = []
    for back in range(WEEKS - 1, -1, -1):
        end = today - timedelta(days=7 * back)
        out.append((end - timedelta(days=6), end))
    return out


def _week_of(day, bounds) -> int | None:
    for index, (start, end) in enumerate(bounds):
        if start <= day <= end:
            return index
    return None


def _first_last(points: list) -> tuple[int | None, int | None, int]:
    """(اولین مقدار، آخرین مقدار، تعدادِ هفته‌های دارای داده)"""
    real = [p for p in points if p is not None]
    if not real:
        return None, None, 0
    return real[0], real[-1], len(real)


# ---------------------------------------------------------------- بُعدها
def _subject_dim(key, subjects, *, bounds, catalog, books, completions, answers, subject_of) -> dict:
    total_slugs = {slug for slug, game in catalog.items()
                   if (books.get(game.book_id).subject if books.get(game.book_id) else "") in subjects}
    first_done: dict = {}
    for completion in completions:
        if completion.game_slug not in total_slugs:
            continue
        day = timezone.localdate(completion.created_at)
        if completion.game_slug not in first_done or day < first_done[completion.game_slug]:
            first_done[completion.game_slug] = day

    total = len(total_slugs)
    points, new_games = [], []
    for start, end in bounds:
        done = sum(1 for day in first_done.values() if day <= end)
        points.append(_pct(done, total) if total else None)
        new_games.append(sum(1 for day in first_done.values() if start <= day <= end))

    month_start = bounds[0][0]
    subject_answers = [a for a in answers if subject_of(a.game_slug) in subjects and _local_day(a) >= month_start]
    accuracy = None
    if len(subject_answers) >= MIN_ANSWERS:
        accuracy = _pct(sum(1 for a in subject_answers if a.is_correct), len(subject_answers))

    done_now = len(first_done)
    status = "none" if not total else ("ok" if done_now else "empty")
    return {
        "key": key, "label": LABELS[key], "kind": "progress", "how": HOW[key], "status": status,
        "points": points,
        "detail": {"total": total, "done": done_now, "newThisMonth": sum(new_games), "weekly": new_games,
                   "answers": len(subject_answers), "accuracy": accuracy},
    }


def _focus_dim(*, bounds, events, sessions) -> dict:
    finished = [0] * WEEKS
    abandoned = [0] * WEEKS
    active_ms = [0] * WEEKS
    idle_ms = [0] * WEEKS
    complete_sessions = {e.session_id for e in events if e.event_type == "game_complete" and e.session_id}
    for session in sessions:
        week = _week_of(_local_day(session), bounds)
        if week is None:
            continue
        payload = session.payload if isinstance(session.payload, dict) else {}
        done = session.event_type == "game_complete" or session.session_id in complete_sessions \
            or payload.get("completed") is True
        if done:
            finished[week] += 1
        elif payload.get("abandoned"):
            abandoned[week] += 1
        else:
            continue  # پایانِ نامعلوم (نسخه‌ی قدیمیِ SDK) در هیچ‌کدام شمرده نمی‌شود
        active_ms[week] += session.duration_ms or 0
    for event in events:
        if event.event_type != "idle":
            continue
        week = _week_of(_local_day(event), bounds)
        payload = event.payload if isinstance(event.payload, dict) else {}
        if week is not None and isinstance(payload.get("ms"), (int, float)):
            idle_ms[week] += int(payload["ms"])

    points = []
    for week in range(WEEKS):
        total = finished[week] + abandoned[week]
        if total < MIN_SESSIONS:
            points.append(None)
            continue
        finish_rate = finished[week] / total
        attention = active_ms[week] / (active_ms[week] + idle_ms[week]) if active_ms[week] + idle_ms[week] else 1
        points.append(round(finish_rate * attention * 100))
    has = any(p is not None for p in points)
    return {
        "key": "focus", "label": LABELS["focus"], "kind": "score", "how": HOW["focus"],
        "status": "ok" if has else "empty", "points": points,
        "detail": {"finished": sum(finished), "abandoned": sum(abandoned), "sessions": [f + a for f, a in
                                                                                       zip(finished, abandoned)],
                   "activeMinutes": round(sum(active_ms) / 60000), "idleMinutes": round(sum(idle_ms) / 60000)},
    }


def _mood_dim(*, bounds, moods) -> dict:
    counts = [0] * WEEKS
    good = [0] * WEEKS
    for checkin in moods:
        week = _week_of(timezone.localtime(checkin.created_at).date(), bounds)
        if week is None:
            continue
        counts[week] += 1
        good[week] += checkin.mood in GOOD_MOODS
    points = [_pct(good[w], counts[w]) if counts[w] >= MIN_CHECKINS else None for w in range(WEEKS)]
    return {
        "key": "mood", "label": LABELS["mood"], "kind": "score", "how": HOW["mood"],
        "status": "ok" if any(p is not None for p in points) else "empty", "points": points,
        "detail": {"checkins": counts, "good": _pct(sum(good), sum(counts)) if sum(counts) else None},
    }


def _finish(dim: dict) -> dict:
    first, last, weeks = _first_last(dim["points"])
    dim["now"] = last
    dim["change"] = last - first if weeks >= 2 else None
    return dim


def _locked(key: str) -> dict:
    return {"key": key, "label": LABELS[key], "kind": "progress" if key == "language" else "score",
            "how": HOW[key], "status": "locked", "locked": True, "points": [None] * WEEKS,
            "now": None, "change": None, "detail": {}}


# ---------------------------------------------------------------- متن‌های قاعده‌محور
def _strength(name: str, dims: dict, concepts: list[dict], active_weeks: int) -> dict | None:
    gains = [d for d in dims.values() if d["kind"] == "progress" and d["detail"].get("newThisMonth", 0) >= 2]
    if gains:
        best = max(gains, key=lambda d: d["detail"]["newThisMonth"])
        first, last, _ = _first_last(best["points"])
        rise = f" و پیشرفتش در کتاب از {_n(first)}٪ به {_n(last)}٪ رسید" if last and first is not None and last > first \
            else ""
        return {"title": f"پیشرفت در {best['label']}",
                "body": f"{name} در این چهار هفته {_n(best['detail']['newThisMonth'])} بازیِ تازه‌ی "
                        f"{best['label']} را تمام کرد{rise}.",
                "link": "details"}
    strong = [c for c in concepts if c["answers"] >= MIN_ANSWERS and c["accuracy"] >= 80]
    if strong:
        best = max(strong, key=lambda c: (c["accuracy"], c["answers"]))
        return {"title": f"«{best['label']}» را خوب گرفته",
                "body": f"{_n(best['accuracy'])}٪ از {_n(best['answers'])} پاسخِ {name} در این مفهوم درست بوده است.",
                "link": "details"}
    focus = dims.get("focus")
    if focus and focus.get("now") is not None and focus["now"] >= 80:
        return {"title": "تمرکزِ خوب در بازی‌ها",
                "body": f"{_n(focus['detail']['finished'])} بازی را تا آخر رفت و تمرکزش این هفته "
                        f"{_n(focus['now'])}٪ بود.",
                "link": "details"}
    if active_weeks >= 3:
        weeks = "هر چهار هفته‌ی" if active_weeks == WEEKS else f"{_n(active_weeks)} هفته از چهار هفته‌ی"
        return {"title": "پیوستگیِ خوب",
                "body": f"{name} در {weeks} گذشته بازی کرد؛ همین پیوستگی پایه‌ی پیشرفت است.",
                "link": "details"}
    if active_weeks:
        return {"title": "شروعِ مسیر",
                "body": f"{name} این ماه بازی‌اش را در لوکو شروع کرده؛ با چند هفته بازیِ منظم نقطه‌های قوتش "
                        f"این‌جا روشن‌تر می‌شود.",
                "link": "daily"}
    return None


def _attention(name: str, dims: dict, concepts: list[dict], *, played_this_week: bool, active_weeks: int,
               late_percent: int) -> dict | None:
    focus = dims.get("focus")
    if focus and focus.get("now") is not None and focus["now"] < 60:
        detail = focus["detail"]
        half = f"؛ {_n(detail['abandoned'])} بازی نیمه‌کاره ماند" if detail["abandoned"] else ""
        return {"title": "تمرکز در بازی‌ها",
                "body": f"تمرکزِ {name} این هفته {_n(focus['now'])}٪ بود{half}. بازی‌های کوتاه‌تر در ساعتِ "
                        f"آرامِ روز کمک می‌کند.",
                "link": "ask"}
    weak = [c for c in concepts if c["answers"] >= MIN_ANSWERS and c["accuracy"] < 70]
    if weak:
        worst = min(weak, key=lambda c: (c["accuracy"], -c["answers"]))
        return {"title": f"«{worst['label']}» تمرینِ بیشتری می‌خواهد",
                "body": f"دقتِ {name} در این مفهوم {_n(worst['accuracy'])}٪ بوده ({_n(worst['answers'])} پاسخ)؛ "
                        f"چند دقیقه تمرینِ آرام در خانه کمک می‌کند.",
                "link": "details"}
    if active_weeks and not played_this_week:
        return {"title": "این هفته بازی نکرده",
                "body": f"{name} در هفت روزِ گذشته بازی نکرده است؛ یک بازیِ کوتاهِ روزانه ریتمِ یادگیری را نگه می‌دارد.",
                "link": "daily"}
    for dim in dims.values():
        if dim["kind"] == "progress" and dim["status"] == "empty":
            return {"title": f"{dim['label']} هنوز شروع نشده",
                    "body": f"از {_n(dim['detail']['total'])} بازیِ {dim['label']}ِ کلاسش هنوز هیچ‌کدام را تمام نکرده است.",
                    "link": "daily"}
    if focus and focus["detail"].get("abandoned", 0) >= 2:
        return {"title": "بازی‌های نیمه‌کاره",
                "body": f"{_n(focus['detail']['abandoned'])} بازیِ {name} در این چهار هفته نیمه‌کاره ماند؛ بازیِ کوتاه‌تر "
                        f"در ساعتی که خسته نیست کمک می‌کند تا آخر برود.",
                "link": "ask"}
    if late_percent >= 30:
        return {"title": "بازی‌های آخرِ شب",
                "body": f"{_n(late_percent)}٪ از بازی‌های این ماهِ {name} بعد از ساعتِ ۲۱ بوده؛ بازی در عصر به "
                        f"خوابِ بهتر کمک می‌کند.",
                "link": "ask"}
    if active_weeks:
        return {"title": "نشانه‌ی نگران‌کننده‌ای نیست",
                "body": f"در داده‌های این چهار هفته‌ی {name} چیزی که توجهِ ویژه بخواهد دیده نشد؛ همین ریتم را نگه دارید.",
                "link": "ask"}
    return None


def _summary(name: str, dims: dict, *, games_month: int, active_weeks: int) -> str:
    if not active_weeks:
        return (f"هنوز در چهار هفته‌ی گذشته بازی‌ای از {name} ثبت نشده؛ با اولین بازی‌ها روندِ رشدش اینجا "
                f"کشیده می‌شود.")
    weeks = "هر چهار هفته" if active_weeks == WEEKS else f"{_n(active_weeks)} هفته از چهار هفته"
    games = f"{_n(games_month)} بازیِ تازه را تمام کرد و " if games_month else ""
    parts = [f"{name} در چهار هفته‌ی گذشته {games}{weeks} فعال بود."]
    rises = []
    for dim in dims.values():
        if dim["kind"] != "progress":
            continue
        first, last, _ = _first_last(dim["points"])
        if last and first is not None and last > first:
            rises.append(f"در {dim['label']} از {_n(first)}٪ به {_n(last)}٪")
    if rises:
        parts.append(f"پیشرفتش {' و '.join(rises)} رسید.")
    focus = dims.get("focus")
    if focus and focus.get("now") is not None:
        change = focus.get("change")
        trend = ""
        if change is not None and change >= 5:
            trend = "، بهتر از هفته‌های قبل"
        elif change is not None and change <= -5:
            trend = "، کمی پایین‌تر از هفته‌های قبل"
        parts.append(f"تمرکزش در بازی‌های این هفته {_n(focus['now'])}٪ بود{trend}.")
    return " ".join(parts)


# ---------------------------------------------------------------- ورودی
def build_growth(*, name: str, today, events, sessions, answers, completions, catalog, books, subject_of,
                 moods, concepts: list[dict], free: bool = False) -> dict:
    bounds = week_bounds(today)
    month_start = bounds[0][0]
    dims: dict[str, dict] = {}
    for key, _, subjects in SUBJECT_DIMS:
        if free and key in FREE_LOCKED:
            dims[key] = _locked(key)
            continue
        dims[key] = _finish(_subject_dim(key, subjects, bounds=bounds, catalog=catalog, books=books,
                                         completions=completions, answers=answers, subject_of=subject_of))
    dims["focus"] = _finish(_focus_dim(bounds=bounds, events=events, sessions=sessions))
    dims["mood"] = _locked("mood") if free else _finish(_mood_dim(bounds=bounds, moods=moods))

    open_dims = {k: d for k, d in dims.items() if not d.get("locked") and d["status"] != "none"}
    month_events = [e for e in events if _local_day(e) >= month_start]
    played_weeks = {_week_of(_local_day(e), bounds) for e in sessions if _local_day(e) >= month_start}
    played_weeks |= {_week_of(timezone.localdate(c.created_at), bounds) for c in completions
                     if timezone.localdate(c.created_at) >= month_start}
    played_weeks.discard(None)
    active_weeks = len(played_weeks)
    games_month = sum(1 for c in completions if timezone.localdate(c.created_at) >= month_start)
    hours = [timezone.localtime(e.occurred_at or e.created_at).hour for e in month_events
             if e.event_type in ("answer", "game_start", "game_complete")]
    late_percent = _pct(sum(1 for h in hours if h in LATE_HOURS), len(hours)) if len(hours) >= 10 else 0

    shown_concepts = concepts if not free else [c for c in concepts if c.get("subject", "") in ("math", "")]
    return {
        "weeks": [{"label": f"هفته‌ی {_n(i + 1)}", "range": f"{fa_date(start)} تا {fa_date(end)}"}
                  for i, (start, end) in enumerate(bounds)],
        "dims": list(dims.values()),
        "active": active_weeks > 0,
        "activeWeeks": active_weeks,
        "gamesThisMonth": games_month,
        "latePercent": late_percent,
        "summary": _summary(name, open_dims, games_month=games_month, active_weeks=active_weeks),
        "strength": _strength(name, open_dims, shown_concepts, active_weeks),
        "attention": _attention(name, open_dims, shown_concepts, played_this_week=3 in played_weeks,
                                active_weeks=active_weeks, late_percent=late_percent),
        "lockedDims": sum(1 for d in dims.values() if d.get("locked")),
        "source": "rules",
    }
