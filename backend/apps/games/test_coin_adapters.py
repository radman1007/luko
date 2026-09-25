"""
کیفِ سکه‌ی مشترکِ بازی‌ها — هر بازیِ واقع در مخزن رابطِ سکه دارد و
`import_games` آن را درست و فقط یک‌بار بالای <head> می‌گذارد.

بازیِ بی‌رابط سکه‌ی جدای خودش را نشان می‌دهد و خریدش از کیفِ بچه کم
نمی‌شود؛ این تست جلوی واردکردنِ دوباره‌ای را می‌گیرد که رابط را جا بیندازد.
"""
import hashlib
import re
from pathlib import Path
from unittest import skipUnless

from django.conf import settings
from django.test import SimpleTestCase

from apps.games.coin_adapters import ADAPTERS, GAME_PATCHES
from apps.games.coin_display import HIDE, hide_css
from apps.games.management.commands.import_games import WALLET_MARK, WALLET_VERSION, prepare

GAMES = Path(settings.BASE_DIR).parent / "frontend" / "public" / "games"


class CoinDisplayShapeTests(SimpleTestCase):
    def test_rules_only_hide_and_never_touch_rewards(self):
        for stem, selectors in HIDE.items():
            with self.subTest(stem=stem):
                self.assertTrue(selectors)
                css = hide_css(stem)
                self.assertIn("visibility: hidden !important", css)
                self.assertNotIn("display: none", css)
                for sel in selectors:
                    self.assertNotRegex(sel.lower(), r"reward|price|float|fly|earn")


class CoinAdapterShapeTests(SimpleTestCase):
    def test_every_adapter_has_get_set_and_valid_seeds(self):
        for stem, adapter in ADAPTERS.items():
            with self.subTest(stem=stem):
                self.assertRegex(adapter, r"^\{seed:\[.*\],get:function\(\)\{return .+;\},set:function\(v\)\{.+\}\}$")
                for key in re.findall(r'key:"([^"]*)"', adapter):
                    self.assertTrue(key and key != "luko_coins", f"{stem}: کلیدِ seed نامعتبر: {key!r}")

    def test_bridge_adapters_have_a_patch_that_builds_the_bridge(self):
        # بازیِ بسته (ماژول/IIFE) بی‌وصله رابطش همیشه خطا می‌دهد و سکه‌اش جدا می‌ماند
        for stem, adapter in ADAPTERS.items():
            if "LUKO_GAME_COINS" not in adapter:
                continue
            with self.subTest(stem=stem):
                targets = [target for _source, target in GAME_PATCHES.get(stem, [])]
                self.assertTrue(any("window.LUKO_GAME_COINS = " in t for t in targets))


@skipUnless(GAMES.is_dir(), "پوشه‌ی بازی‌های فرانت در این محیط نیست")
class RepoGamesWalletTests(SimpleTestCase):
    def games(self):
        return sorted(GAMES.glob("*.html"))

    def test_every_game_has_an_adapter(self):
        missing = [p.stem for p in self.games() if p.stem not in ADAPTERS]
        self.assertEqual(missing, [], "بازیِ بی‌رابطِ سکه")

    def test_wallet_block_is_injected_once_at_the_top_of_head(self):
        for path in self.games():
            with self.subTest(game=path.name):
                text = path.read_text(encoding="utf-8")
                self.assertEqual(text.count(WALLET_MARK), 1)
                self.assertEqual(text.count(f'src="/games/assets/luko-wallet.js?v={WALLET_VERSION}"'), 1)
                head = re.search(r"<head[^>]*>", text, re.I)
                # کیف باید پیش از هر اسکریپتِ خودِ بازی اجرا شود
                first_script = text.find("<script", head.end())
                self.assertEqual(text.find(WALLET_MARK, head.end()), text.find("\n", head.end()) + 1)
                self.assertLess(text.find(WALLET_MARK), first_script)

    def test_prepare_is_idempotent_on_the_repo_files(self):
        for path in self.games():
            with self.subTest(game=path.name):
                text = path.read_text(encoding="utf-8")
                self.assertEqual(prepare(text, path.stem), text)

    def test_every_game_hides_its_own_coin_display(self):
        # موجودی فقط در سربرگِ سایت؛ بازیِ بی‌ورودی چیپِ سکه‌ی خودش را نشان می‌دهد
        missing = [p.stem for p in self.games() if not HIDE.get(p.stem)]
        self.assertEqual(missing, [], "بازیِ بی‌گزینشگرِ پنهان‌کردنِ سکه (apps/games/coin_display.py)")

    def test_hide_rule_is_inside_the_wallet_block_once(self):
        for path in self.games():
            with self.subTest(game=path.name):
                text = path.read_text(encoding="utf-8")
                rule = hide_css(path.stem)
                self.assertEqual(text.count(rule), 1)
                block = text[text.find(WALLET_MARK):text.find('src="/games/assets/luko-wallet.js')]
                self.assertIn(rule, block)

    def test_wallet_version_matches_the_script(self):
        # مرورگر /games/assets/ را هفت روز نگه می‌دارد؛ تغییرِ کیف بی‌نسخه‌ی تازه به بچه نمی‌رسید
        script = (GAMES / "assets" / "luko-wallet.js").read_bytes()
        self.assertEqual(WALLET_VERSION, hashlib.sha256(script).hexdigest()[:12],
                         "luko-wallet.js عوض شده: WALLET_VERSION را تازه کن و import_games را دوباره بزن")

    def test_game_patches_are_applied(self):
        for stem, patches in GAME_PATCHES.items():
            text = (GAMES / f"{stem}.html").read_text(encoding="utf-8")
            for _source, target in patches:
                self.assertIn(target, text)
