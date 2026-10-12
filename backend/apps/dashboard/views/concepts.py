"""
تگ‌های آموزشی — تیمِ طراحی این‌جا تعریف می‌کند، تیمِ بازی‌ساز همان `code` را روی هر پاسخ
می‌فرستد (docs/event-tracking-guide.md)، و پنلِ والدین با `title` نشانش می‌دهد.

«تگ‌های ثبت‌نشده» همان کدهایی است که بازی‌ها فرستاده‌اند ولی این‌جا نیستند — معمولاً غلطِ
املایی در کدِ بازی یا تگی که هنوز ثبت نشده؛ تا ثبت نشوند والد آن مفهوم را نمی‌بیند.
"""
from datetime import timedelta

from django import forms
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework.response import Response

from apps.common.fa import fa_date
from apps.games.models import ConceptTag, Game, GameEvent
from apps.games.naming import BOOKS
from apps.games.telemetry import TAG_RE

from .. import audit
from ..security import DashboardView, error, paginate
from ..segments import normalized_query
from .podcasts import form_errors

#: درس‌ها همان کتاب‌های مسیرِ بازی
SUBJECTS = {book.slug: book.name for book in BOOKS.values()}
#: پنجره‌ی «چقدر استفاده شده»
USAGE_DAYS = 30
UNKNOWN_DAYS = 60


class ConceptTagForm(forms.ModelForm):
    class Meta:
        model = ConceptTag
        fields = ("code", "title", "subject", "grade", "description", "is_active")

    def clean_code(self):
        code = (self.cleaned_data.get("code") or "").strip().lower()
        if not TAG_RE.match(code):
            raise forms.ValidationError("فقط حروفِ کوچکِ انگلیسی، رقم، _ و -؛ با حرف شروع شود (مثلِ addition_2digit).")
        if self.instance.pk and code != self.instance.code and _used(self.instance.code):
            raise forms.ValidationError(
                "این کد در رویدادهای ثبت‌شده هست و عوض‌کردنش آمارِ قبلی را جدا می‌کند؛ "
                "تگِ تازه بسازید و این یکی را غیرفعال کنید.")
        return code

    def clean_subject(self):
        subject = (self.cleaned_data.get("subject") or "").strip()
        if subject and subject not in SUBJECTS:
            raise forms.ValidationError("درس معتبر نیست.")
        return subject


def _used(code: str) -> int:
    return GameEvent.objects.filter(concept_tag=code).count()


def concept_row(tag: ConceptTag, usage: dict | None = None) -> dict:
    usage = usage or {}
    return {
        "id": tag.id,
        "code": tag.code,
        "title": tag.title,
        "subject": tag.subject,
        "subject_label": SUBJECTS.get(tag.subject, ""),
        "grade": tag.grade,
        "description": tag.description,
        "is_active": tag.is_active,
        "answers": usage.get("answers", 0),
        "errors": usage.get("errors", 0),
        "games": usage.get("games", 0),
    }


def _usage(codes: list[str]) -> dict[str, dict]:
    """پاسخ‌ها، خطاها و تعدادِ بازی‌هایی که هر تگ را در ۳۰ روزِ اخیر فرستاده‌اند — یک کوئری"""
    since = timezone.now() - timedelta(days=USAGE_DAYS)
    rows = (GameEvent.objects.filter(event_type="answer", concept_tag__in=codes, occurred_at__gte=since)
            .values("concept_tag")
            .annotate(answers=Count("id"), errors=Count("id", filter=Q(is_correct=False)),
                      games=Count("game_slug", distinct=True)))
    return {row["concept_tag"]: row for row in rows}


def _form(request, instance=None):
    data = {}
    if instance is not None:
        data = {name: getattr(instance, name) for name in ConceptTagForm.Meta.fields}
    for name in ConceptTagForm.Meta.fields:
        if name in request.data:
            data[name] = request.data.get(name)
    if data.get("grade") in ("", None):
        data["grade"] = None
    if instance is None and "is_active" not in data:
        data["is_active"] = True                   # تگِ تازه فعال است، مگر صریحاً خاموش
    if isinstance(data.get("is_active"), bool) and not data["is_active"]:
        data.pop("is_active")                      # چک‌باکسِ خاموش یعنی نبودنِ کلید
    return ConceptTagForm(data=data, instance=instance)


class ConceptListView(DashboardView):
    """GET ?q=&subject=&grade=&active= · POST"""

    capability = "concepts"

    def get(self, request):
        p = request.query_params
        qs = ConceptTag.objects.all()
        q = normalized_query(p.get("q", ""))
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(title__icontains=q) | Q(description__icontains=q))
        if p.get("subject"):
            qs = qs.filter(subject=p["subject"])
        if p.get("grade", "").isdigit():
            qs = qs.filter(grade=int(p["grade"]))
        if p.get("active") in ("true", "false"):
            qs = qs.filter(is_active=p["active"] == "true")
        page, meta = paginate(request, qs.order_by("grade", "subject", "code"), default=50)
        usage = _usage([tag.code for tag in page])
        return Response({"results": [concept_row(tag, usage.get(tag.code)) for tag in page], **meta})

    def post(self, request):
        form = _form(request)
        if not form.is_valid():
            return error(form_errors(form))
        tag = form.save()
        audit.record(request, "concept_create", target=tag, target_type="concept", target_label=tag.code)
        return Response(concept_row(tag), status=201)


class ConceptDetailView(DashboardView):
    capability = "concepts"

    def patch(self, request, pk):
        tag = ConceptTag.objects.filter(pk=pk).first()
        if tag is None:
            return error("تگ پیدا نشد.", 404)
        form = _form(request, tag)
        if not form.is_valid():
            return error(form_errors(form))
        tag = form.save()
        audit.record(request, "concept_update", target=tag, target_type="concept", target_label=tag.code,
                     details={"fields": sorted(form.changed_data)})
        return Response(concept_row(tag, _usage([tag.code]).get(tag.code)))

    def delete(self, request, pk):
        tag = ConceptTag.objects.filter(pk=pk).first()
        if tag is None:
            return error("تگ پیدا نشد.", 404)
        used = _used(tag.code)
        if used:
            return error(f"این تگ در {used} رویداد ثبت شده؛ به‌جای حذف، غیرفعالش کنید.", 409)
        code = tag.code
        tag.delete()
        audit.record(request, "concept_delete", target_type="concept", target_label=code, details={"id": pk})
        return Response({"ok": True})


class UnknownConceptView(DashboardView):
    """کدهایی که بازی‌ها در ۶۰ روزِ اخیر فرستاده‌اند ولی ثبت نشده‌اند"""

    capability = "concepts"

    def get(self, request):
        since = timezone.now() - timedelta(days=UNKNOWN_DAYS)
        known = ConceptTag.objects.values_list("code", flat=True)
        rows = list(
            GameEvent.objects.filter(occurred_at__gte=since).exclude(concept_tag="")
            .exclude(concept_tag__in=known)
            .values("concept_tag")
            .annotate(count=Count("id"), last=Max("occurred_at"), games=Count("game_slug", distinct=True))
            .order_by("-count")[:100]
        )
        slugs = dict(
            GameEvent.objects.filter(occurred_at__gte=since, concept_tag__in=[r["concept_tag"] for r in rows])
            .values_list("concept_tag", "game_slug").distinct()
        )
        titles = dict(Game.objects.filter(slug__in=slugs.values()).values_list("slug", "title"))
        return Response({"results": [{
            "code": row["concept_tag"],
            "count": row["count"],
            "games": row["games"],
            "example_game": titles.get(slugs.get(row["concept_tag"]), slugs.get(row["concept_tag"], "")),
            "last_seen_fa": fa_date(timezone.localtime(row["last"]).date()) if row["last"] else "",
        } for row in rows]})
