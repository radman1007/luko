from django.conf import settings
from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html

from apps.common.admin_helpers import ReadOnlyAdmin, jalali
from apps.common.fa import fa_digits

from . import registry
from .models import Book, ConceptTag, Game, GameCompletion, GameEvent, SeasonMemory
from .registry import title_hint


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    """کتاب‌های درسی — هر کتاب یک «دنیا» در نقشه‌ی بازی‌هاست."""

    list_display = ("title", "book_id", "subject", "grade", "game_count",
                    "is_active", "sort")
    list_editable = ("sort", "is_active")
    list_filter = ("grade", "subject", "is_active")
    search_fields = ("title", "book_id", "subject")
    ordering = ("grade", "sort")

    @admin.display(description="بازی‌ها")
    def game_count(self, obj):
        """
        شمارِ بازی‌های کتاب، با لینک به فهرستشان.

        `Game` به `Book` کلیدِ خارجی ندارد (با رشته‌ی `book_id` وصل می‌شوند)،
        پس inline ممکن نیست؛ این لینک همان کار را می‌کند.
        """
        count = Game.objects.playable().filter(book_id=obj.book_id).count()
        if not count:
            return format_html('<span style="color:#bbb">ندارد</span>')
        url = reverse("admin:games_game_changelist")
        return format_html('<a href="{}?book_id={}">{} بازی</a>',
                           url, obj.book_id, fa_digits(count))


_STATUS_COLOR = {
    Game.Status.READY: "#2e7d32",
    Game.Status.INVALID: "#c62828",
    Game.Status.CONFLICT: "#e65100",
    Game.Status.MISSING: "#9e9e9e",
}


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    """
    کاتالوگِ بازی‌ها.

    ردیف‌ها از نامِ فایل‌ها ساخته می‌شوند (دکمه‌ی «همگام‌سازی با فایل‌ها» یا
    `manage.py sync_games`)، پس افزودنِ دستی ندارد و جایگاه فقط‌خواندنی است:
    برای جابه‌جا کردنِ بازی نامِ فایلش را عوض کن. عنوان، پاداش‌ها و «فعال»
    مالِ ادمین است و همگام‌سازی به آن‌ها دست نمی‌زند.
    """

    change_list_template = "admin/games/game/change_list.html"
    list_display = ("title", "code_display", "status_badge", "season_order",
                    "rewards", "title_warning", "is_active")
    list_display_links = ("title",)
    list_editable = ("is_active",)
    list_filter = ("status", "grade", "book_code", "chapter", "is_active")
    search_fields = ("slug", "title", "game_file", "book_id")
    ordering = ("grade", "season_order", "id")
    list_per_page = 100
    readonly_fields = ("slug", "status", "review_note", "grade", "book_code", "chapter",
                       "week", "number", "season_order", "book_id", "order",
                       "game_file", "content_hash")
    fieldsets = (
        ("بازی", {"fields": ("title", "slug", "is_active")}),
        ("وضعیت", {"fields": ("status", "review_note")}),
        ("جایگاه — از نامِ فایل", {
            "fields": ("grade", "book_code", "chapter", "week", "number",
                       "season_order", "book_id", "order"),
            "description": "برای جابه‌جایی نامِ فایل را عوض کن و دوباره همگام‌سازی کن.",
        }),
        ("فایل", {"fields": ("game_file", "content_hash")}),
        ("پاداش", {"fields": ("max_stars", "coin_reward", "dew_reward",
                              "fertilizer_reward")}),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        # بازیِ روی مسیر پاک نمی‌شود: همگام‌سازیِ بعدی با شناسه‌ی تازه
        # برش می‌گرداند و پیشرفتِ بچه‌ها از آن جدا می‌شد. غیرفعالش کن.
        if obj is not None and obj.status == Game.Status.READY:
            return False
        return super().has_delete_permission(request, obj)

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions

    @admin.display(description="کد فایل", ordering="season_order")
    def code_display(self, obj):
        if obj.status in (Game.Status.READY, Game.Status.CONFLICT) and obj.code:
            return format_html('<code dir="ltr">{}</code>', obj.code)
        name = obj.game_file.rsplit("/", 1)[-1]
        return format_html('<code dir="ltr" style="color:#999">{}</code>', name or "—")

    @admin.display(description="وضعیت", ordering="status")
    def status_badge(self, obj):
        return format_html('<b style="color:{}" title="{}">{}</b>',
                           _STATUS_COLOR.get(obj.status, "#333"), obj.review_note,
                           obj.get_status_display())

    @admin.display(description="پاداش (سکه/شبنم/کود)")
    def rewards(self, obj):
        return fa_digits(f"{obj.coin_reward} / {obj.dew_reward} / {obj.fertilizer_reward}")

    @admin.display(description="عنوان")
    def title_warning(self, obj):
        hint = title_hint(obj.title)
        if not hint:
            return ""
        return format_html('<span style="color:#e65100">«{}» درس را لو می‌دهد</span>', hint)

    # ---- همگام‌سازی از پنل ----
    def get_urls(self):
        view = self.admin_site.admin_view(self.sync_view)
        return [path("sync/", view, name="games_game_sync"), *super().get_urls()]

    def sync_view(self, request):
        """
        GET: پیش‌نمایش (هیچ چیز ذخیره نمی‌شود). POST: اعمال.
        گزارشِ کامل همین‌جا دیده می‌شود، نه در پیام‌های کوتاهِ بالای صفحه.
        """
        if not self.has_change_permission(request):
            raise PermissionDenied
        applying = request.method == "POST"
        error = ""
        result = None
        try:
            result = registry.sync(settings.GAME_FILES_DIR, dry_run=not applying)
        except (FileNotFoundError, registry.SyncBusy) as exc:
            error = str(exc)
        if applying and result is not None and not result.blocked:
            messages.success(request, "کاتالوگِ بازی‌ها به‌روز شد — " + registry.summary(result))
        context = {
            **self.admin_site.each_context(request),
            "title": "همگام‌سازیِ بازی‌ها با فایل‌ها",
            "opts": self.model._meta,
            "report": registry.render(result) if result is not None else "",
            "error": error,
            "applied": applying and result is not None and not result.blocked,
            "blocked": result.blocked if result is not None else "",
            "folder": settings.GAME_FILES_DIR,
        }
        return TemplateResponse(request, "admin/games/game/sync.html", context)


@admin.register(GameCompletion)
class GameCompletionAdmin(ReadOnlyAdmin):
    """بازی‌هایی که بچه‌ها تمام کرده‌اند — تاریخچه است، پس دست‌کاری نمی‌شود."""

    list_display = ("user", "phone", "game_slug", "shown_stars", "coins_awarded", "done")
    search_fields = ("user__phone", "user__first_name", "game_slug")
    list_filter = ("stars",)
    list_select_related = ("user",)
    date_hierarchy = "created_at"
    list_per_page = 50

    done = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    @admin.display(description="بهترین ستاره", ordering="stars")
    def shown_stars(self, obj):
        if not obj.stars:
            return format_html('<span style="color:#bbb">بدون ستاره</span>')
        return "★" * obj.stars


@admin.register(SeasonMemory)
class SeasonMemoryAdmin(ReadOnlyAdmin):
    """
    عکس‌های یادگاریِ بچه‌ها از نقشه‌ی سیزن.

    خودِ تصویر عمداً در فهرست نمی‌آید: عکسِ بچه است و باز کردنِ بی‌دلیلش در
    پنل درست نیست. اندازه‌اش را می‌شود دید تا اگر ردیفی خراب بود معلوم شود.
    """

    list_display = ("user", "phone", "season_id", "spot_id", "size", "taken")
    search_fields = ("user__phone", "user__first_name", "season_id", "spot_id")
    list_filter = ("season_id",)
    list_select_related = ("user",)
    list_per_page = 50

    taken = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    @admin.display(description="حجم تصویر")
    def size(self, obj):
        kb = round(len(obj.image or "") / 1024)
        return fa_digits(f"{kb} کیلوبایت") if kb else "—"


@admin.register(GameEvent)
class GameEventAdmin(ReadOnlyAdmin):
    """رویدادهای داخلِ بازی — ورودیِ تحلیل‌های بعدی."""

    list_display = ("user", "phone", "game_slug", "event_type", "concept_tag", "is_correct",
                    "attempt_number", "error_type", "at")
    list_filter = ("event_type", "is_correct", "error_type", "schema_version")
    search_fields = ("user__phone", "game_slug", "event_type", "concept_tag", "session_id")
    list_select_related = ("user",)
    date_hierarchy = "occurred_at"
    list_per_page = 50

    at = jalali("occurred_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)


@admin.register(ConceptTag)
class ConceptTagAdmin(admin.ModelAdmin):
    """تگ‌های آموزشی — تیمِ طراحی تعریف می‌کند، بازی‌ها روی هر پاسخ می‌فرستند (همین‌ها در داشبورد هم هست)."""

    list_display = ("code", "title", "subject", "grade", "is_active")
    list_editable = ("is_active",)
    list_filter = ("subject", "grade", "is_active")
    search_fields = ("code", "title", "description")
