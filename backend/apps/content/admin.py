import requests
from django import forms
from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html, format_html_join

from apps.common.admin_helpers import ReadOnlyAdmin, jalali
from apps.common.fa import fa_digits

from .models import Podcast, PodcastListen, Recipe, TrafficRule, Video, VideoInteraction


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    """ویدیوهای لوکو تلویزیون. «تعداد بازدید» را سرور می‌شمارد."""

    list_display = ("title", "category", "duration_minutes", "shown_views",
                    "likes", "is_active", "sort")
    list_filter = ("category", "is_active")
    list_editable = ("is_active", "sort")
    search_fields = ("title",)
    ordering = ("sort", "-created_at")

    @admin.display(description="تعداد بازدید", ordering="views")
    def shown_views(self, obj):
        return fa_digits(obj.views)

    @admin.display(description="پسند")
    def likes(self, obj):
        return fa_digits(obj.interactions.filter(liked=True).count())


class CategoryInput(forms.TextInput):
    """فیلدِ متنیِ دسته با پیشنهاد (datalist): دسته‌های پیش‌فرض + هرچه قبلاً به‌کار رفته."""

    def __init__(self, options=(), attrs=None):
        super().__init__({**(attrs or {}), "list": "podcast-categories", "autocomplete": "off"})
        self.options = list(options)

    def render(self, name, value, attrs=None, renderer=None):
        field = super().render(name, value, attrs, renderer)
        options = format_html_join("", '<option value="{}">', ((o,) for o in self.options))
        return format_html('{}<datalist id="podcast-categories">{}</datalist>', field, options)


def audio_link_problem(url: str) -> str | None:
    """
    نشانیِ بیرونی واقعاً فایلِ صوتی است؟ پیوندِ «صفحه‌ی پخش» (مثلِ online.php ِ سایت‌های
    آپلود) HTML برمی‌گرداند و پخش‌کننده‌ی سایت نمی‌تواند پخشش کند. اگر نشانی در دسترس
    نبود، جلوی ذخیره را نمی‌گیریم — فقط وقتی مطمئنیم صفحه‌ی وب است.
    """
    try:
        res = requests.get(url, stream=True, timeout=8, allow_redirects=True,
                           headers={"Range": "bytes=0-1023", "User-Agent": "LukoAdmin/1.0"})
        kind = res.headers.get("Content-Type", "").split(";")[0].strip().lower()
        res.close()
    except requests.RequestException:
        return None
    if kind in ("text/html", "application/xhtml+xml"):
        return ("این نشانی صفحه‌ی وب است، نه فایلِ صوتی؛ پخش‌کننده‌ی سایت نمی‌تواند پخشش کند. "
                "فایل را دانلود کنید و همین بالا در «فایل صوتی» بارگذاری کنید.")
    return None


class PodcastAdminForm(forms.ModelForm):
    class Meta:
        model = Podcast
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "category" in self.fields:
            used = Podcast.objects.order_by().values_list("category", flat=True).distinct()
            options = list(dict.fromkeys([*Podcast.SUGGESTED_CATEGORIES, *(c for c in used if c)]))
            self.fields["category"].widget = CategoryInput(options)

    def clean(self):
        data = super().clean()
        # فرمِ ویرایشِ داخلِ فهرست (فعال/ترتیب) این دو فیلد را ندارد؛ آن‌جا چیزی برای چک نیست
        if "audio_file" in self.fields and "audio_url" in self.fields:
            has_file = bool(data.get("audio_file"))     # فایلِ تازه یا فایلی که از قبل بود
            url = data.get("audio_url")
            if not has_file and not url:
                self.add_error("audio_file", "فایلِ صوتی را بارگذاری کنید (یا نشانیِ مستقیمِ فایل را بنویسید).")
            # فایلِ بارگذاری‌شده مقدم است؛ نشانی فقط وقتی پخش می‌شود که فایلی نباشد
            # نشانیِ http را اعتبارسنجِ فیلد رد می‌کند؛ فقط https ارزشِ بازکردن دارد
            elif url and not has_file and "audio_url" in self.changed_data and url.lower().startswith("https://"):
                problem = audio_link_problem(url)
                if problem:
                    self.add_error("audio_url", problem)
        return data


@admin.register(Podcast)
class PodcastAdmin(admin.ModelAdmin):
    """
    قسمت‌های لوکو پادکست. فقط ردیفی که «صدا دارد» در سایت دیده می‌شود؛
    مدت با انتخابِ فایل خودش پر می‌شود (podcast_admin.js).
    """

    form = PodcastAdminForm
    list_display = ("title", "category", "shown_duration", "has_audio", "listens", "is_active", "sort")
    list_filter = ("category", "is_active")
    list_editable = ("is_active", "sort")
    search_fields = ("title",)
    ordering = ("sort", "-created_at")
    readonly_fields = ("audio_preview",)
    fieldsets = (
        (None, {"fields": ("title", "category", "icon")}),
        ("صدا", {"fields": ("audio_file", "audio_url", "audio_preview", "duration_minutes")}),
        ("نمایش", {"fields": ("is_active", "sort")}),
    )

    class Media:
        js = ("content/podcast_admin.js",)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(listen_count=Count("listens"))

    @admin.display(description="مدت", ordering="duration_minutes")
    def shown_duration(self, obj):
        return fa_digits(f"{obj.duration_minutes} دقیقه") if obj.duration_minutes else "—"

    @admin.display(description="صدا دارد", boolean=True)
    def has_audio(self, obj):
        return obj.has_audio

    @admin.display(description="تعداد گوش‌دادن", ordering="listen_count")
    def listens(self, obj):
        return fa_digits(obj.listen_count)

    @admin.display(description="پیش‌شنو")
    def audio_preview(self, obj):
        # از دیتابیس، نه از obj: وقتی فرم خطا دارد، obj فایلِ ردشده‌ی ذخیره‌نشده را دارد
        stored = Podcast.objects.filter(pk=obj.pk).values("audio_file", "audio_url").first() if obj and obj.pk else None
        if not stored or not (stored["audio_file"] or stored["audio_url"]):
            return "بعد از ذخیره، همین‌جا می‌شود صدا را گوش داد."
        src = Podcast._meta.get_field("audio_file").storage.url(stored["audio_file"]) if stored["audio_file"] else stored["audio_url"]
        return format_html(
            '<audio controls preload="metadata" src="{}" style="width:100%;max-width:440px"></audio>', src
        )


@admin.register(TrafficRule)
class TrafficRuleAdmin(admin.ModelAdmin):
    """قانونِ روزِ جاده — هر روز یکی از ردیف‌های فعال نشان داده می‌شود."""

    list_display = ("text", "rule_key", "has_game", "is_active", "sort")
    list_filter = ("has_game", "is_active")
    list_editable = ("has_game", "is_active", "sort")
    search_fields = ("text", "rule_key")
    ordering = ("sort", "id")


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    """خوراکیِ روزِ سرآشپز زعفران."""

    list_display = ("name", "recipe_key", "item_count", "has_game", "is_active", "sort")
    list_filter = ("has_game", "is_active")
    list_editable = ("has_game", "is_active", "sort")
    search_fields = ("name", "recipe_key")
    ordering = ("sort", "id")

    @admin.display(description="تعداد ماده")
    def item_count(self, obj):
        return fa_digits(len(obj.ingredients or []))


@admin.register(VideoInteraction)
class VideoInteractionAdmin(ReadOnlyAdmin):
    """بازدید و پسندِ بچه‌ها روی ویدیوها."""

    list_display = ("user", "phone", "video", "liked", "viewed", "at")
    list_filter = ("liked", "viewed")
    search_fields = ("user__phone", "video__title")
    list_select_related = ("user", "video")
    list_per_page = 50

    at = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)


@admin.register(PodcastListen)
class PodcastListenAdmin(ReadOnlyAdmin):
    list_display = ("user", "phone", "podcast", "shown_seconds", "at")
    search_fields = ("user__phone", "podcast__title")
    list_select_related = ("user", "podcast")
    date_hierarchy = "created_at"
    list_per_page = 50

    at = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    @admin.display(description="مدت", ordering="seconds")
    def shown_seconds(self, obj):
        return fa_digits(f"{obj.seconds} ثانیه")
