"""
«پیشنهادِ این هفته» برای والدین — چند کارِ کوچک و عملی برای بهترشدنِ یادگیریِ بچه.

فعلاً قاعده‌محور و از داده‌ی واقعیِ همین بچه ساخته می‌شود (مفهومِ پرخطا و نوعِ خطایش، ساعتِ
بازی، زمانِ تمرین، راهنماها، حال‌ودل، پیوستگی). شکلِ خروجی ثابت است تا بعداً مدلِ زبانی همین را
شخصی‌سازی کند: هر پیشنهاد {id, kind, title, body} و کلِ فهرست با `source` (rules | ai).
"""
from __future__ import annotations

from apps.common.fa import fa_digits

MAX_TIPS = 4
#: کمترین پاسخ برای این‌که مفهومی «نیاز به تمرین» حساب شود
MIN_ANSWERS = 4
WEAK_ACCURACY = 70
LATE_HOURS = {21, 22, 23, 0, 1, 2, 3, 4, 5}

ERROR_ADVICE = {
    "conceptual": "بیشترِ خطاهایش در این مفهوم «مفهومی» است؛ یعنی هنوز ایده‌اش جا نیفتاده. با وسایلِ خانه "
                  "(حبه‌ی قند، دکمه، مداد) یک مثالِ ملموس بسازید و بگذارید خودش برایتان توضیح دهد.",
    "procedural": "مفهوم را می‌داند ولی در مرحله‌ها اشتباه می‌کند. یک مسئله را با هم قدم‌به‌قدم روی کاغذ "
                  "حل کنید و از او بخواهید هر قدم را بلند بگوید.",
    "careless": "خطاهایش در این مفهوم بیشتر از عجله است. از او بخواهید پیش از انتخاب، جواب را یک بار "
                "بلند بگوید؛ همین مکثِ کوتاه خطا را کم می‌کند.",
    "timeout": "در این مفهوم وقت کم می‌آورد. چند تمرینِ آرام و بی‌زمان با هم انجام دهید تا اعتمادبه‌نفسش بالا برود.",
}


def build_tips(*, name: str, learning: dict, hourly: list[dict], week_minutes: int, week_hints: int,
               dominant_mood: str, mood_checkins: int, streak: int) -> dict:
    tips: list[dict] = []

    weak = [c for c in learning.get("concepts", [])
            if c["answers"] >= MIN_ANSWERS and c["accuracy"] < WEAK_ACCURACY]
    if weak:
        concept = max(weak, key=lambda c: (c["errors"], -c["accuracy"]))
        kind = concept["errorTypes"][0]["key"] if concept["errorTypes"] else ""
        tips.append({
            "id": f"concept:{concept['tag']}",
            "kind": "practice",
            "title": f"کمی تمرینِ بیشتر در «{concept['label']}»",
            "body": ERROR_ADVICE.get(kind) or (
                f"این هفته روزی ده دقیقه با هم روی «{concept['label']}» کار کنید و از مثال‌های روزمره کمک بگیرید."),
        })

    total = sum(bucket["count"] for bucket in hourly)
    late = sum(bucket["count"] for bucket in hourly if bucket["hour"] in LATE_HOURS)
    if total >= 10 and late / total >= 0.3:
        tips.append({
            "id": "late-play",
            "kind": "sleep",
            "title": "بازی‌ها نزدیکِ ساعتِ خواب است",
            "body": f"بخشِ زیادی از بازی‌های {name} دیرِ شب انجام شده. یک زمانِ ثابت در عصر برایش بگذارید؛ "
                    "ذهنِ خسته کمتر یاد می‌گیرد و خوابش هم بهتر می‌شود.",
        })

    if week_minutes < 30:
        tips.append({
            "id": "routine",
            "kind": "routine",
            "title": "یک زمانِ ثابتِ روزانه",
            "body": (f"{name} این هفته {fa_digits(week_minutes)} دقیقه بازی کرده. " if week_minutes else "")
                    + "روزی ده دقیقه در یک ساعتِ ثابت (مثلاً بعد از ناهار) کافی است تا یادگیری عادت شود.",
        })

    if week_hints >= 5:
        tips.append({
            "id": "hints",
            "kind": "together",
            "title": "راهنماها را با هم بخوانید",
            "body": f"{name} این هفته {fa_digits(week_hints)} بار راهنمایی خواسته؛ یعنی دوست دارد بفهمد. یکی دو "
                    "بازی را کنارش بنشینید و بگذارید راهنما را برایتان بخواند.",
        })

    if mood_checkins >= 3 and dominant_mood in {"sad", "angry", "tired"}:
        feeling = {"sad": "ناراحت", "angry": "عصبانی", "tired": "خسته"}[dominant_mood]
        tips.append({
            "id": "mood",
            "kind": "mood",
            "title": "کمی بیشتر هم‌صحبتی",
            "body": f"در لوکو بیشتر حالِ «{feeling}» را ثبت کرده. یک گفتگوی آرام و بی‌قضاوت درباره‌ی روزش، "
                    "بیش از هر تمرینی کمک می‌کند.",
        })

    if streak >= 3:
        tips.append({
            "id": "streak",
            "kind": "praise",
            "title": "پیوستگی‌اش را جشن بگیرید",
            "body": f"{fa_digits(streak)} روزِ پشتِ‌سرِ هم بازی کرده. تشویقِ کلامی و یک جایزه‌ی کوچکِ غیرخوراکی "
                    "انگیزه‌ی ادامه را بیشتر می‌کند.",
        })

    # پیشنهادهای همیشگی تا فهرست هیچ‌وقت خالی یا تک‌خطی نماند
    for generic in (
        {"id": "retell", "kind": "together", "title": "بازیِ امروز را بپرسید",
         "body": f"شب از {name} بخواهید بازیِ امروزش را برایتان تعریف کند؛ توضیح‌دادن، یادگیری را عمیق‌تر می‌کند."},
        {"id": "goal", "kind": "goal", "title": "یک هدفِ کوچکِ هفتگی",
         "body": "با هم یک هدفِ کوچک بگذارید (مثلاً «سه بازی تا جمعه») و آخرِ هفته با هم مرورش کنید."},
        {"id": "praise-effort", "kind": "praise", "title": "تلاش را تشویق کنید، نه فقط نتیجه را",
         "body": "به‌جای «آفرین که درست گفتی» بگویید «آفرین که تا آخر تلاش کردی»؛ بچه‌ها با این جمله کمتر از اشتباه می‌ترسند."},
    ):
        if len(tips) >= 3:
            break
        tips.append(generic)

    return {"source": "rules", "items": tips[:MAX_TIPS]}
