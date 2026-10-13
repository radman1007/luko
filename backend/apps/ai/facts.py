"""
«برگه‌ی داده» برای مدل: خلاصه‌ی عددیِ همان گزارشی که والد می‌بیند.

از گزارشِ *بعد از قفلِ اشتراک* ساخته می‌شود (gating.gate_report)؛ پس برای پلنِ رایگان هیچ داده‌ای
از درس‌های قفل یا حالِ دقیقِ روزانه به مدل نمی‌رسد. نام، شماره، مدرسه و نوشته‌های صندوقچه هم
نمی‌روند؛ مدل به‌جای نام «[نام]» می‌نویسد. جنگو لازم ندارد (روی سرور با گزارشِ نمونه آزموده می‌شود).
"""
from __future__ import annotations

import hashlib
import json

#: همان برچسب‌های apps/games/naming.BOOKS
SUBJECT_FA = {"math": "ریاضی", "science": "علوم", "quran": "قرآن", "writing": "نگارش", "art": "هنر", "farsi": "فارسی"}
GRADE_FA = {1: "اول", 2: "دوم", 3: "سوم", 4: "چهارم", 5: "پنجم", 6: "ششم"}
MOOD_FA = {"happy": "شاد", "calm": "آرام", "tired": "خسته", "sad": "ناراحت", "angry": "عصبانی"}
TREND_FA = {"up": "بهتر از هفته‌ی پیش", "down": "کمی پایین‌تر از هفته‌ی پیش", "flat": "مثلِ هفته‌ی پیش"}
LATE_HOURS = {21, 22, 23, 0, 1, 2, 3, 4, 5}
MAX_CONCEPTS = 6


def _pct(part: int, total: int) -> int:
    return round(part / total * 100) if total else 0


def _kpis(report: dict) -> dict:
    return {item["key"]: item["value"] for item in report.get("kpis", [])}


def _week(report: dict) -> dict:
    kpi = _kpis(report)
    learning = (report.get("learning") or {}).get("week") or {}
    days = report.get("week") or []
    minutes = learning.get("minutes", kpi.get("time", 0))
    prev = learning.get("prevMinutes", 0)
    answers = report.get("answersThisWeek", learning.get("answers", 0))
    out = {
        "active_days_of_7": sum(1 for d in days if d.get("minutes", 0) > 0 or d.get("games", 0) > 0),
        "minutes": minutes,
        "answers": answers,
        "streak_days": kpi.get("streak", 0),
        "average_session_minutes": kpi.get("session", 0),
    }
    if kpi.get("games"):
        out["games_completed"] = kpi["games"]
    if answers:
        out["accuracy_percent"] = kpi.get("accuracy", 0)
        first = learning.get("firstTry") or {}
        if first.get("asked"):
            out["first_try_percent"] = first.get("rate", 0)
    # «هفته‌ی قبل ۰ دقیقه» جمله‌ی بدی می‌سازد (آزمونِ پروداکشن)؛ صفر را با یک بله/خیر می‌گوییم
    if prev:
        out["previous_week_minutes"] = prev
    else:
        out["played_previous_week"] = False
    # عددهای مشتق را خودمان حساب می‌کنیم تا مدل حساب نکند (و عددِ ساختگی نسازد)
    if prev:
        out["minutes_change_vs_previous_week"] = minutes - prev
        out["minutes_change_percent"] = round((minutes - prev) / prev * 100)
        if minutes >= prev * 2:
            out["minutes_times_previous_week"] = round(minutes / prev)
    busiest = max(days, key=lambda d: d.get("minutes", 0), default=None)
    if busiest and busiest.get("minutes"):
        out["busiest_day"] = {"day": busiest.get("day", ""), "minutes": busiest["minutes"]}

    hourly = report.get("hourly") or []
    total = sum(b.get("count", 0) for b in hourly)
    if total >= 10:
        late = sum(b.get("count", 0) for b in hourly if b.get("hour") in LATE_HOURS)
        out["late_night_activity_percent"] = _pct(late, total)
        peak = max(hourly, key=lambda b: b.get("count", 0))
        out["most_active_hour"] = peak.get("hour")
    return out


def _subjects(report: dict) -> tuple[list[dict], list[str]]:
    """(درس‌هایی که داده دارند، درس‌هایی که بازی دارند ولی هنوز شروع نشده‌اند)"""
    out, not_started = [], []
    for item in report.get("subjects") or []:
        if item.get("locked") or item.get("label") == "عمومی":
            continue
        answers = item.get("answers", 1 if item.get("mastery") else 0)
        if not answers and not item.get("gamesDone"):
            if item.get("gamesTotal"):
                not_started.append(item["label"])
            continue
        row = {"name": item["label"], "games_available": item.get("gamesTotal", 0)}
        # دقت فقط وقتی پاسخی ثبت شده؛ وگرنه «۰٪» برای مدل یعنی «همه غلط» (آزمونِ پروداکشن، ۲۲ مهر)
        if answers:
            row["answers_last_8_weeks"] = answers
            row["accuracy_percent_last_8_weeks"] = item.get("mastery", 0)
        else:
            row["note"] = "games played but no answers recorded"
        # «۰ بازی از ۱۲» جمله‌ی بدی می‌سازد؛ صفر را نمی‌فرستیم
        if item.get("gamesDone"):
            row["games_completed"] = item["gamesDone"]
        if item.get("weakestTopic"):
            row["weakest_topic"] = item["weakestTopic"]
        out.append(row)
    return out, not_started


def _concepts(report: dict) -> list[dict]:
    concepts = (report.get("learning") or {}).get("concepts") or []
    out = []
    for c in concepts[:MAX_CONCEPTS]:
        row = {
            "name": c["label"],
            "subject": SUBJECT_FA.get(c.get("subject", ""), "عمومی"),
            "answers": c["answers"],
            "accuracy_percent": c["accuracy"],
            "errors": c["errors"],
        }
        if c.get("firstTryAsked"):
            row["first_try_percent"] = c.get("firstTryRate", 0)
        if c.get("avgSeconds"):
            row["average_seconds_per_answer"] = c["avgSeconds"]
        if c.get("hints"):
            row["hints_asked"] = c["hints"]
        if c.get("errorTypes"):
            row["most_common_error"] = c["errorTypes"][0]["label"]
        out.append(row)
    return out


def _locked_subjects(report: dict) -> list[str]:
    return [s["label"] for s in report.get("subjects") or [] if s.get("locked")]


def _mood_week(health: dict) -> dict | None:
    weekly = health.get("weekly") or {}
    if weekly.get("verdict") in (None, "none"):
        return None
    out = {
        "verdict": weekly.get("label", ""),
        "checkins": (weekly.get("stats") or {}).get("checkins", 0),
        "moods": {MOOD_FA.get(m["mood"], m["mood"]): m["count"] for m in weekly.get("mix") or []},
        "breathing_exercises": (weekly.get("stats") or {}).get("breathing", 0),
        "paintings": (weekly.get("stats") or {}).get("paintings", 0),
    }
    counts = sorted((m["count"] for m in weekly.get("mix") or []), reverse=True)
    # «بیشترین حال» فقط وقتی معنا دارد که تنها بیشینه باشد؛ ۲ و ۲ و ۲ یعنی حالِ غالبی نبود
    if weekly.get("dominant") and (len(counts) < 2 or counts[0] > counts[1]):
        out["most_common_mood"] = MOOD_FA.get(weekly["dominant"], weekly["dominant"])
    if weekly.get("trend"):
        out["compared_to_previous_week"] = TREND_FA.get(weekly["trend"], "")
    return out


def _mood_daily(health: dict) -> dict | None:
    daily = health.get("daily") or {}
    if daily.get("locked") or not daily.get("checkins"):
        return None
    out = {
        "window": "چهار هفته‌ی اخیر",
        "checkins": daily["checkins"],
        "good_mood_percent_overall": daily.get("baseline", 0),
        "day_parts": [
            {"part": p["label"], "checkins": p["count"], "good_mood_percent": p["good"],
             **({"note": "بهترین بخشِ روز" if p.get("tag") == "best" else "سخت‌ترین بخشِ روز"} if p.get("tag") else {})}
            for p in daily.get("parts") or [] if p.get("count")
        ],
        "after_subjects": [
            {"subject": s["subject"], "checkins": s["count"], "good_mood_percent": s["good"],
             "difference_from_average": s["lift"]}
            for s in daily.get("subjects") or []
        ],
        "interests": [{"interest": i["label"], "detail": i["detail"]} for i in daily.get("interests") or []],
    }
    learning = daily.get("learning")
    if learning:
        out["accuracy_when_mood_good"] = learning["good"]["accuracy"]
        out["accuracy_when_mood_low"] = learning["low"]["accuracy"]
    if daily.get("favoriteColor"):
        out["favorite_color"] = daily["favoriteColor"]["label"]
    return out


def build_facts(report: dict, *, premium: bool, grade: int | None = None) -> dict | None:
    """
    برگه‌ی داده‌ی یک بچه، یا None وقتی چیزی برای تحلیل نیست (هفته‌ی بی‌بازی و بی‌ثبتِ حال)
    — آن‌وقت همان متن‌های قاعده‌محور کافی است و هزینه‌ای نمی‌دهیم.
    """
    weekly = report.get("weekly") or {}
    health = report.get("health") or {}
    mood_week = _mood_week(health)
    active = bool(weekly.get("active"))
    if not active and not mood_week:
        return None

    subjects, not_started = _subjects(report)
    facts: dict = {
        "plan": "full" if premium else "free",
        "grade": f"{GRADE_FA.get(grade, '')} دبستان".strip() if grade else "دبستان",
        "period": weekly.get("period") or (health.get("weekly") or {}).get("period", ""),
        "played_this_week": active,
        "week": _week(report),
        "subjects": subjects,
        "concepts_last_8_weeks": _concepts(report),
    }
    if not_started:
        facts["subjects_not_started"] = not_started
    if not premium:
        facts["locked_subjects"] = _locked_subjects(report)
    if mood_week:
        facts["mood_this_week"] = mood_week
    if premium:
        daily = _mood_daily(health)
        if daily:
            facts["mood_details"] = daily
    return facts


def fingerprint(facts: dict) -> str:
    """تحلیلِ ذخیره‌شده فقط وقتی نشان داده می‌شود که داده‌اش همین باشد"""
    raw = json.dumps(facts, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()
