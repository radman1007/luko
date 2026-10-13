"""
قفلِ اشتراک در گزارشِ والد: بدونِ اشتراک فقط درسِ ریاضی باز است — گزارشِ هفتگی و پیشنهادها هم
فقط از همان می‌گویند — و از «پیشنهادِ این هفته» فقط اولی کامل نشان داده می‌شود؛ بقیه با عنوان
می‌آیند تا والد ببیند چه چیزی منتظرش است.

روی گزارشِ کش‌شده و *بعد* از کش اعمال می‌شود (گزارش بینِ همه یکی است، اشتراک نه)؛ پس خرید
همان لحظه قفل را باز می‌کند. داده‌ی درس‌های قفل از سرور بیرون نمی‌رود، فقط پنهانش نمی‌کنیم.
"""
from __future__ import annotations

#: بخش‌هایی که services دو نسخه می‌سازد: کامل، و `<نام>Free` فقط از درس‌های باز
FREE_VARIANTS = ("weekly", "tips", "insights", "sessions")
#: درس‌هایی که بی‌اشتراک باز است (برچسبِ کتاب‌ها؛ «عمومی» یعنی بازیِ بی‌کتاب، درس نیست)
FREE_SUBJECTS = {"ریاضی", "عمومی"}
#: همان درس با کدِ تگ‌های آموزشی (تگِ بی‌درس هم باز می‌ماند)
FREE_CONCEPT_SUBJECTS = {"math", ""}
FREE_TIPS = 1


def gate_report(report: dict, premium: bool) -> dict:
    out = dict(report)
    # نسخه‌های رایگان (فقط از درس‌های باز) جز از همین‌جا بیرون نمی‌روند
    free = {key: out.pop(f"{key}Free", None) for key in FREE_VARIANTS}
    out["premium"] = premium
    if premium:
        return out

    for key, value in free.items():
        if value is not None:
            out[key] = value

    out["subjects"] = [
        subject if subject["label"] in FREE_SUBJECTS else {
            **subject, "locked": True, "mastery": 0, "gamesDone": 0, "trend": "flat", "weakestTopic": "",
        }
        for subject in report.get("subjects", [])
    ]
    out["topics"] = [t for t in report.get("topics", []) if t.get("subject", "") in FREE_CONCEPT_SUBJECTS]
    # آمارِ ریزِ بازی‌های درس‌های دیگر هم قفل است، وگرنه قفلِ درس از «گزارشِ کامل» دور زده می‌شد
    games = report.get("games", [])
    out["games"] = [g for g in games if g.get("subjectLabel", "عمومی") in FREE_SUBJECTS]
    out["lockedGames"] = len(games) - len(out["games"])

    learning = report.get("learning")
    if learning:
        concepts = learning.get("concepts", [])
        free = [c for c in concepts if c.get("subject", "") in FREE_CONCEPT_SUBJECTS]
        out["learning"] = {**learning, "concepts": free, "lockedConcepts": len(concepts) - len(free)}

    tips = out.get("tips")
    if tips:
        out["tips"] = {**tips, "items": [
            tip if index < FREE_TIPS else {"id": tip["id"], "kind": tip["kind"], "title": tip["title"],
                                           "body": "", "locked": True}
            for index, tip in enumerate(tips.get("items", []))
        ]}
    return out
