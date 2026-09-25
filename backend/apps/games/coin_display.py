"""
نمایشِ موجودیِ سکه داخلِ بازی‌ها — پنهان.

هر بازیِ استودیو چیپِ سکه‌ی خودش را دارد (سربرگِ منو، بازی، فروشگاه). حالا که
سکه‌ی بازی همان کیفِ بچه است (luko-wallet.js)، موجودی فقط یک جا دیده می‌شود:
سربرگِ خودِ سایت (بالای صفحه‌ی بازی در اپ). این‌جا برای هر بازی گزینشگرِ همان
چیپ‌ها ثبت است و `import_games` آن‌ها را در بلوکِ کیف پنهان می‌کند.

- `visibility: hidden` نه `display: none`: جای چیپ می‌ماند و بقیه‌ی سربرگِ بازی
  (دکمه‌ی صدا، عنوان، توقف) جابه‌جا نمی‌شود؛ پنهان کلیک هم نمی‌گیرد.
- فقط **موجودی** پنهان است. جایزه‌ی هر پاسخ («+۲ سکه»)، قیمتِ کالاهای فروشگاه و
  پاداشِ پایانِ مرحله دیده می‌شوند.
- گزینشگرها با پیمایشِ هر بازی درآمده‌اند: بازی با کیفِ ۷۳۹ بالا می‌آید و هر عنصری
  که ۷۳۹ نشان می‌دهد پیدا می‌شود؛ هر گزینشگر فقط همان یک عنصر را می‌گیرد.
  بازیِ تازه بی‌ورودی این‌جا چیپِ خودش را نشان می‌دهد و `test_coin_adapters` می‌شکند.
"""

HIDE: dict[str, list[str]] = {
    "C1KfF2S2g2": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C1KnF1S1g1": ["#menu-screen div.coin-display", "#shop-screen div.coin-display"],
    "C1KnF1S1g2": ["#menu-screen div.coin-display", "#shop-screen div.coin-display"],
    "C1KnF1S1g3": ["#screen-main div.coin-display", "#screen-levels div.coin-display", "#screen-help div.coin-display", "#screen-shop div.coin-display", "#screen-game div.coin-display"],
    "C1KnF1S1g4": ["#screen-main div.coin-display", "#screen-levels div.coin-display", "#screen-game div.coin-display", "#screen-shop div.coin-display"],
    "C1KnF1S2g5": ["#menuCoinCount", "#gameCoinCount"],
    "C1KnF1S2g6": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C1KnF1S2g7": ["#menu-screen div.coin-display", "#shop-screen div.coin-display"],
    "C1KnF2S1g1": ["#main-menu div.coin-display", "#shop-screen div.coin-display"],
    "C1KnF2S1g2": ["#screen-main div.coins-display", "#screen-levels div.coins-display", "#screen-game div.coins-display", "#screen-shop div.coins-display"],
    "C1KnF2S1g3": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C1KnF2S3G1": ["#shop-coins", "#coin-display", "#levels-view div.coin-chip"],
    "C1KoF1S1g1": ["#menu-container div.coin-display", "#shop-page div.shop-coin"],
    "C1KoF1S1g2": ["#menu-scene div.coin-display", "#shop-scene div.shop-coin"],
    "C1KoF1S1g3": ["#menu-screen div.coin-display", "#shop-screen div.shop-coin"],
    "C1KoF1S2g4": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C1KoF2S1g2": ["#menu-screen div.coin-display", "#shop-screen div.shop-coin"],
    "C1KoF3S1g1": ["#menu-screen div.coin-display", "#shop-screen div.shop-coin"],
    "C1KqF1S1g1": ["#coinCounter"],
    "C1KqF1S1g2": ["#home-page div.coin-display", "#shop-screen div.coin-display", "#game-screen div.header-coin-display", "#end-screen div.coin-display"],
    "C1KqF1S1g3": ["#menu-page div.coin-display", "#shop-page div.coin-display.inline", "#game-page div.header-coin-display"],
    "C1KqF1S1g4": ["#app-wrapper div.coin-display"],
    "C1KrF15S1g1": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C1KrF1S1G5": ["#shopBalance", "#coinDisplay"],
    "C1KrF1S1g1": ["#screen-menu div.coin-display", "#screen-shop div.coin-display"],
    "C1KrF1S1g2": ["#app div.coin-display"],
    "C1KrF1S1g3": ["#welcomeScreen div.coin-display", "#shopCoinCount"],
    "C1KrF1S1g4": ["#start-screen div.coin-display", "#game-screen div.coin-display-mini", "#shop-screen div.shop-coins"],
    "C1KrF1S2g10": ["#start-screen div.coin-display", "#game-screen div.coin-display", "#shop-screen div.coin-display"],
    "C1KrF1S2g6": ["#menu-screen div.coin-display", "#shop-screen div.coin-display"],
    "C1KrF1S2g7": ["#menu-screen div.coin-display", "#shop-screen div.coin-display"],
    "C1KrF1S2g8": ["#loko-coin", ".shop-balance"],             # موجودیِ فروشگاه فقط هنگامِ باز شدن پر می‌شود
    "C1KrF1S2g9": ["#menu-screen div.coin-display", "#shop-screen div.coin-display"],
    "C1KrF3S1g1": ["#screen-menu div.coin-display", "#screen-shop div.coin-display"],
    "C1KrF4S1G1": ["#menuCoin", "#shopCoin", "#gameCoin"],
    "C1KrF4S1G2": ["#home-coins span.coin-chip", "#shop-coins span.coin-chip"],
    "C1KrF4S1g4": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C1KrF6S1g1": ["#main-menu div.coin-display"],
    "C1KrF6S1g2": ["#landingCoinChip", "#shopModal div.coin-display"],
    "C1KrF8S1g1": ["#screen-menu div.coin-display", "#screen-shop div.coin-display"],
    "C2KfF1S1G1": ["#coinBadge", "#scr-shop span.head-spacer"],
    "C2KhF1S1G1": ["#scr-home div.coin-pill", "#scr-levels div.coin-pill", "#scr-help div.coin-pill", "#scr-shop div.coin-pill", "#scr-stage div.coin-pill", "#scr-final div.coin-pill"],
    "C2KnF6S1g1": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C2KoF3S3g8": ["#gameHUD div.coin-display", "#startScreen div.coin-display", "#shopScreen div.coin-display"],
    "C2KrF1S1G1": ["#scr-menu div.coin-display", "#scr-levels div.coin-display.small", "#scr-shop div.coin-display.small", "#scr-game div.coin-mini"],
    "C2KrF1S1G11": ["#screen-menu div.coin-chip.menu-chip", "#screen-shop div.coin-chip.shop-balance", "#screen-game div.coin-chip"],
    "C2KrF1S1G2": ["#coinDisplay", "#coinPillGame"],
    "C2KrF1S1G3": ["#coinDisplay", "#gameScreen div.coin-pill"],
    "C2KrF1S1G4": ["#coinDisplay", "#gameCoinDisplay"],
    "C2KrF1S1G5": ["#page-home span.coinPill", "#page-guide span.coinPill.sm", "#page-shop span.coinPill.sm", "#page-game span.coinPill.sm"],
    "C2KrF1S1G6": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C2KrF1S1G7": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C2KrF1S1G8": ["#chipHome", "#chipShop", "#chipGame", "#chipEnd"],
    "C2KrF1S1G9": ["#homeChip", "#scr-shop div.coin-display", "#gameChip"],
    "C2KrF1S2G8": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KfF2S1G1": ["#coinChip", "#scr-shop .shop-wallet"],
    "C3KhF1S2G1": ["#coinChip"],
    "C3KoF12S1G1": ["#screen-landing div.coin-display", "#screen-shop div.shop-coin"],
    "C3KoF12S1G2": ["#landingScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KoF12S1G3": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KqF1S1G1": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KqF3S2G1": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KrF1S14g1": ["#scr-home div.coin-pill.corner-l", "#scr-shop div.coin-pill.small", "#gamePill"],
    "C3KrF1S1G1": [".header-controls > .coin-display", "#landingScreen div.coin-display.coin-display-lg"],
    "C3KrF1S1G10": ["#page-home div.coin-chip", "#page-shop div.coin-chip"],
    "C3KrF1S1G11": ["#coin-pill"],
    "C3KrF1S1G2": ["#landing-page div.coin-display"],
    "C3KrF1S1G3": ["#coinDisplay"],
    "C3KrF1S1G4": ["#coinDisplay"],
    "C3KrF1S1G5": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KrF1S1G6": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KrF1S1G7": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KrF1S1G8": ["#scr-home span.coin-badge", "#scr-shop span.coin-badge.inline", "#scr-game span.coin-badge.inline"],
    "C3KrF1S1G9": ["#scrHome div.coin-display", "#scrShop div.coin-display", "#scrGame div.coin-display"],
    "C3KrF1S2G6": ["#coinChip"],
    "C3KrF1S2G7": ["#menuCoin", "#helpCoin", "#shopCoin", "#hudCoin", "#expCoin"],
    "C3KrF1S2G8": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KrF1S3G13": ["#homeCoin", "#scr-levels div.coin-pill.sm", "#scr-shop div.coin-pill.sm", "#gameCoin", "#endOverlay div.end-coins"],
    "C3KrF1S3G14": ["#screen-home div.coin-chip", "#screen-levels div.coin-chip.small", "#screen-game div.coin-chip.small", "#screen-shop div.coin-chip.small"],
    "C3KrF1S5G1": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C3KrF1S5G2": ["#homeScreen div.coin-display", "#shopScreen div.shop-coin"],
    "C4KfF1S2G1": ["#scr-menu div.coin-display.corner-left", "#scr-shop span.coin-display", "#scr-game span.coin-display"],
    "C4KnF1S1G2": ["#landingScreen div.coin-display", "#shopScreen div.shop-coin", "#congratsCoin"],  # باقیِ سکه بعد از خرید
    "C4KrF1S1G1": ["div.coin-display.coin-display-sm", "#landingCoinBox"],
}

# همان فایل با چند نام (نجاتِ قبیله، پیام‌های آسمانی)
for _stem, _same in (("C1KrF1S1G6", "C1KrF1S1G5"), ("C2KrF1S1G10", "C1KrF1S1G5"),
                     ("C3KqF3S2G2", "C3KqF3S2G1"), ("C3KqF3S5G1", "C3KqF3S2G1"),
                     ("C3KqF3S11G1", "C3KqF3S2G1")):
    HIDE[_stem] = HIDE[_same]


def hide_css(stem: str) -> str:
    """قاعده‌ی CSSِ پنهان‌کردنِ چیپ‌های سکه‌ی یک بازی ('' اگر ثبت نشده)."""
    selectors = HIDE.get(stem)
    if not selectors:
        return ""
    return ("<style>/* لوکو: موجودی فقط در سربرگِ سایت (apps/games/coin_display.py) */ "
            + ", ".join(selectors) + " { visibility: hidden !important; }</style>\n")
