"""
پایانِ بازی‌ها — هر بازیِ مخزن نقطه‌ی پایانِ خودش را دارد و پلِ حدسی برایش خاموش است.

حدسِ پل (`luko-bridge.js`) بعضی بازی‌ها را هرگز تمام نمی‌کرد و بعضی را با
باخت یا خریدِ پوسته «تمام» می‌کرد. این تست جلوی واردکردنِ دوباره‌ای را می‌گیرد
که نقطه‌ی پایان را جا بیندازد، یا وصله‌ای را که دیگر با کدِ بازی نمی‌خواند.
"""
from pathlib import Path
from unittest import skipUnless

from django.conf import settings
from django.test import SimpleTestCase

from apps.games.finish_points import FINISH, FINISH_HELPER
from apps.games.game_fixes import FIXES
from apps.games.management.commands.import_games import prepare

GAMES = Path(settings.BASE_DIR).parent / "frontend" / "public" / "games"


class FinishPointShapeTests(SimpleTestCase):
    def test_every_point_calls_the_helper(self):
        for stem, patches in FINISH.items():
            with self.subTest(stem=stem):
                self.assertTrue(patches, "وصله‌ی خالی")
                for source, target in patches:
                    self.assertIn(source, target, "وصله باید متنِ اصلی را نگه دارد و فقط چیزی کنارش بگذارد")
                    self.assertRegex(target, r"luko(Win|Count|Levels)\(")

    def test_helper_disables_the_bridge_guess(self):
        self.assertIn("window.LUKO_EXPLICIT_FINISH = true", FINISH_HELPER)


@skipUnless(GAMES.is_dir(), "پوشه‌ی بازی‌های فرانت در این محیط نیست")
class RepoGamesFinishTests(SimpleTestCase):
    def games(self):
        return sorted(GAMES.glob("*.html"))

    def test_every_game_has_a_finish_point(self):
        missing = [p.stem for p in self.games() if p.stem not in FINISH]
        self.assertEqual(missing, [], "بازیِ بی‌نقطه‌ی پایان — فقط با حدسِ پل تمام می‌شود")

    def test_points_and_fixes_are_in_the_files_once(self):
        for path in self.games():
            text = path.read_text(encoding="utf-8")
            with self.subTest(game=path.name):
                self.assertEqual(text.count("window.LUKO_EXPLICIT_FINISH = true"), 1)
                # حدسِ پل برای این بازی خالی است
                self.assertIn("window.LUKO_WIN = []; window.LUKO_WIN_MAYBE = [];", text)
                for _source, target in FINISH[path.stem] + FIXES.get(path.stem, []):
                    self.assertEqual(text.count(target), 1)

    def test_import_keeps_the_files_as_they_are(self):
        for path in self.games():
            with self.subTest(game=path.name):
                text = path.read_text(encoding="utf-8")
                self.assertEqual(prepare(text, path.stem), text)
