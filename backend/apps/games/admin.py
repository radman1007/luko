from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from apps.common.admin_helpers import ReadOnlyAdmin, jalali
from apps.common.fa import fa_digits

from .models import Book, Game, GameCompletion, GameEvent, SeasonMemory


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
        count = Game.objects.filter(book_id=obj.book_id).count()
        if not count:
            return format_html('<span style="color:#bbb">ندارد</span>')
        url = reverse("admin:games_game_changelist")
        return format_html('<a href="{}?book_id={}">{} بازی</a>',
                           url, obj.book_id, fa_digits(count))


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    """
    کاتالوگِ بازی‌ها.

    پاداش‌ها این‌جا تعریف می‌شوند چون سرور از روی همین‌ها جایزه می‌دهد؛
    عددِ فرانت هیچ‌وقت ملاک نیست.
    """

    list_display = ("title", "slug", "book_id", "order", "season_order",
                    "rewards", "ready", "is_active")
    list_editable = ("order", "season_order", "is_active")
    list_filter = ("book_id", "is_active", "max_stars")
    search_fields = ("slug", "title", "book_id")
    ordering = ("book_id", "order")
    list_per_page = 50
    fieldsets = (
        ("شناسه", {"fields": ("slug", "title", "book_id")}),
        ("جایگاه", {
            "fields": ("order", "season_order"),
            "description": "«ترتیب در مسیر سیزن» صفر یعنی این بازی روی مسیر نیست.",
        }),
        ("فایل", {
            "fields": ("game_file",),
            "description": "خالی یعنی بازی هنوز نرسیده و لینکِ امضاشده ساخته نمی‌شود.",
        }),
        ("پاداش", {"fields": ("max_stars", "coin_reward", "dew_reward",
                              "fertilizer_reward")}),
        ("وضعیت", {"fields": ("is_active",)}),
    )

    @admin.display(description="پاداش (سکه/شبنم/کود)")
    def rewards(self, obj):
        return fa_digits(f"{obj.coin_reward} / {obj.dew_reward} / {obj.fertilizer_reward}")

    @admin.display(description="فایل دارد", boolean=True, ordering="game_file")
    def ready(self, obj):
        return bool(obj.game_file)


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

    list_display = ("user", "phone", "game_slug", "event_type", "at")
    list_filter = ("event_type",)
    search_fields = ("user__phone", "game_slug", "event_type")
    list_select_related = ("user",)
    date_hierarchy = "created_at"
    list_per_page = 50

    at = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)
