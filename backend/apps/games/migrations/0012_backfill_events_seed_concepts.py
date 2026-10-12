"""
پر کردنِ ستون‌های تازه‌ی GameEvent برای رویدادهای قبل از نسخه‌ی ۳ (از روی payload)،
و ساختنِ تگ‌های آموزشی از مبحث‌هایی که بازی‌ها تا امروز می‌فرستادند (همان برچسب‌های
گزارشِ والدین) تا هیچ عنوانی که والد می‌دید از دست نرود.

منطقِ این‌جا عمداً کپیِ ساده‌شده‌ی apps/games/telemetry.normalize است: مهاجرت نباید به
کدی وابسته باشد که بعداً عوض می‌شود.
"""
import re
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

from django.db import migrations

TAG_RE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
SESSION_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
DURATION_TYPES = {"game_end", "game_complete", "level_end", "results_finalized"}
ERROR_TYPES = {"conceptual", "procedural", "careless", "timeout", "other"}

# (کد، عنوان، درس، پایه)
SEED = [
    ("count", "شمارش", "math", 1), ("compare", "مقایسه", "math", 1),
    ("sort", "ترتیب اعداد", "math", 1), ("missing", "دنباله‌ی اعداد", "math", 1),
    ("pattern", "الگو", "math", 1), ("match", "تطبیق و دسته‌بندی", "math", 1),
    ("classify", "دسته‌بندی", "math", 1), ("number-id", "شناختِ عدد", "math", 1),
    ("write-number", "نوشتنِ عدد", "math", 1), ("add", "جمع", "math", 1),
    ("subtract", "تفریق", "math", 1), ("arithmetic", "محاسبه", "math", 1),
    ("balance", "تعادل و جمع", "math", 1), ("logic", "منطق و جدول", "math", 1),
    ("direction", "جهت و مسیر", "math", 1),
    ("trace", "خط‌کشیدن روی الگو", "writing", 1), ("trace-curve", "خط خمیده", "writing", 1),
    ("write-letter", "نوشتنِ حرف", "writing", 1), ("letter", "حرف‌شناسی", "writing", 1),
    ("line-shape", "تشخیصِ خطِ صاف و کج", "writing", 1),
    ("classify-science", "دسته‌بندیِ خوراکی‌ها", "science", 1),
    ("listen", "شنیدن و تشخیص", "quran", 1), ("quran-find", "یافتنِ نعمت‌ها", "quran", 1),
    ("quran-read", "خواندنِ بسم‌الله", "quran", 1), ("quran-art", "نقاشیِ بسم‌الله", "quran", 1),
    ("fraction", "کسر", "math", None), ("ratio", "نسبت و تناسب", "math", None),
    ("percent", "درصد", "math", None), ("lcm", "ک.م.م و بخش‌پذیری", "math", None),
    ("integer", "عددهای صحیح", "math", None), ("average", "میانگین", "math", None),
    ("addition_2digit", "جمعِ دو رقمی", "math", 2),
]


def _int(value, low, high):
    if value is None or isinstance(value, bool):
        return None
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError, OverflowError):
        return None
    return number if low <= number <= high else None


def _when(value, received):
    at = None
    if isinstance(value, str) and value:
        try:
            at = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            at = None
        if at is not None and at.tzinfo is None:
            at = at.replace(tzinfo=dt_timezone.utc)
    if at is None or at > received + timedelta(minutes=5) or at < received - timedelta(days=30):
        return received
    return at


def backfill(apps, schema_editor):
    GameEvent = apps.get_model("games", "GameEvent")
    fields = ["occurred_at", "session_id", "concept_tag", "level", "is_correct", "time_taken_ms",
              "attempt_number", "error_type", "hint_used", "duration_ms"]
    batch = []
    for event in GameEvent.objects.filter(occurred_at__isnull=True).order_by("id").iterator(chunk_size=1000):
        p = event.payload if isinstance(event.payload, dict) else {}
        answer = event.event_type == "answer"
        event.occurred_at = _when(p.get("at"), event.created_at)
        session = p.get("sessionId")
        event.session_id = session if isinstance(session, str) and SESSION_RE.match(session) else ""
        topic = p.get("topic")
        event.concept_tag = topic.lower() if isinstance(topic, str) and TAG_RE.match(topic.lower()) else ""
        event.level = _int(p.get("level"), 0, 10_000)
        event.is_correct = p.get("correct") if answer and isinstance(p.get("correct"), bool) else None
        event.time_taken_ms = _int(p.get("ms"), 0, 3_600_000) if answer else None
        event.attempt_number = _int(p.get("attempt"), 1, 1000) if answer else None
        error_type = p.get("errorType")
        event.error_type = error_type if error_type in ERROR_TYPES else ""
        event.hint_used = p.get("hintUsed") if isinstance(p.get("hintUsed"), bool) else None
        if event.event_type in DURATION_TYPES:
            event.duration_ms = _int(p.get("activeMs", p.get("durationMs")), 0, 6 * 3_600_000)
        batch.append(event)
        if len(batch) >= 1000:
            GameEvent.objects.bulk_update(batch, fields)
            batch = []
    if batch:
        GameEvent.objects.bulk_update(batch, fields)


def seed_concepts(apps, schema_editor):
    ConceptTag = apps.get_model("games", "ConceptTag")
    for code, title, subject, grade in SEED:
        ConceptTag.objects.get_or_create(code=code, defaults={"title": title, "subject": subject, "grade": grade})


class Migration(migrations.Migration):

    dependencies = [
        ("games", "0011_event_tracking_v3"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.RunPython(seed_concepts, migrations.RunPython.noop),
    ]
