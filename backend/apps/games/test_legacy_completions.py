"""
تکمیل‌های جامانده از ترتیبِ قبلیِ مسیر (مهاجرتِ games/0010) و شمارشِ پروفایل.

بچه‌ای که روی مرحله‌ی ۶ است نباید «۷ بازیِ تمام‌شده» ببیند؛ و تکمیلِ جلوتر
از جایش که بعد از جابه‌جاییِ مسیر ثبت شده (واقعی) نباید پاک شود.
"""
import importlib
from datetime import datetime, timedelta, timezone

from django.apps import apps as django_apps
from django.test import TestCase

from apps.accounts.models import User
from apps.games.models import Game, GameCompletion
from apps.games.services import completed_count

migration = importlib.import_module("apps.games.migrations.0010_drop_legacy_out_of_order_completions")
BEFORE = migration.CUTOFF - timedelta(days=10)
AFTER = migration.CUTOFF + timedelta(days=2)


class LegacyCompletionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for i in range(1, 15):
            Game.objects.create(slug=f"p-{i}", title=f"مرحله {i}", grade=1, season_order=i,
                                status=Game.Status.READY, is_active=True)
        Game.objects.create(slug="other-grade", title="کلاسِ دوم", grade=2, season_order=1,
                            status=Game.Status.READY, is_active=True)

    def kid(self, done: dict[int, datetime]) -> User:
        user = User.objects.create(phone="09120000000", role=User.Role.STUDENT, grade=1)
        for order, at in done.items():
            c = GameCompletion.objects.create(user=user, game_slug=f"p-{order}")
            GameCompletion.objects.filter(pk=c.pk).update(created_at=at)
        return user

    def run_migration(self):
        migration.forwards(django_apps, None)

    def slugs(self, user):
        return sorted(GameCompletion.objects.filter(user=user).values_list("game_slug", flat=True),
                      key=lambda s: int(s.split("-")[1]))

    def test_old_book_order_leftovers_are_removed(self):
        # مرحله‌های ۱ تا ۵ پشتِ هم، و ۹ و ۱۳ از ترتیبِ کتاب‌به‌کتابِ قبلی
        user = self.kid({1: BEFORE, 2: AFTER, 3: BEFORE, 4: AFTER, 5: BEFORE, 9: BEFORE, 13: BEFORE})
        self.assertEqual(completed_count(user), 7)
        self.run_migration()
        self.assertEqual(self.slugs(user), [f"p-{i}" for i in range(1, 6)])
        self.assertEqual(completed_count(user), 5)

    def test_stages_ahead_recorded_after_the_reorder_stay(self):
        # جابه‌جاییِ بعدیِ فایل‌ها: مرحله‌ی تازه جلوی کارِ واقعیِ بچه افتاده
        user = self.kid({1: AFTER, 2: AFTER, 4: AFTER, 5: AFTER})
        self.run_migration()
        self.assertEqual(self.slugs(user), ["p-1", "p-2", "p-4", "p-5"])

    def test_contiguous_progress_is_untouched(self):
        user = self.kid({i: BEFORE for i in range(1, 8)})
        self.run_migration()
        self.assertEqual(len(self.slugs(user)), 7)

    def test_count_ignores_games_off_the_kids_path(self):
        user = self.kid({1: AFTER})
        GameCompletion.objects.create(user=user, game_slug="other-grade")
        GameCompletion.objects.create(user=user, game_slug="removed-game")
        self.assertEqual(completed_count(user), 1)
