"""
رفعِ باگِ خودِ بازی‌ها — چیزهایی که بچه را وسطِ بازی گیر می‌انداخت.

مثلِ بقیه‌ی وصله‌ها `import_games` این‌ها را روی فایلِ استودیو می‌گذارد؛ هر
(متنِ اصلی، متنِ تازه) باید دقیقاً یک‌بار در فایل باشد و اجرای دوباره بی‌اثر است.
نقطه‌ی پایانِ بازی‌ها جدا در `finish_points.py` است.
"""


def _css(rules: str) -> tuple[str, str]:
    return "</head>", f"<style>/* لوکو: رفعِ باگ (apps/games/game_fixes.py) */\n{rules}\n</style>\n</head>"


FIXES: dict[str, list[tuple[str, str]]] = {
    # آزمایشگاهِ میوه‌ها
    "C1KoF1S1g2": [
        # چاقو روی گوشی ۳۵ پیکسل می‌شد و روی لبه‌ی تیره‌ی سینک گم بود؛ بچه پیدایش
        # نمی‌کرد و بازی همان‌جا می‌ماند. بزرگ‌تر، روی پیشخوان، و وقتی نوبتش است می‌درخشد.
        # متنِ معرفیِ میوه‌ها خاکستری/زرد روی شیشه‌ی روشن بود و خوانده نمی‌شد.
        _css("""
.knife-item { width: 132px !important; }
@keyframes lukoGlow {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 201, 60, 0)); }
  50% { filter: drop-shadow(0 0 10px rgba(255, 201, 60, 1)) drop-shadow(0 0 3px #fff); }
}
.knife-item.luko-attn img { animation: lukoGlow 1.1s ease-in-out infinite; }
.intro-container.glass-card, .fruit-select-container.glass-card { background: rgba(30, 22, 58, 0.74) !important; }
.intro-fact, .intro-fun-fact { color: #E6E4F2 !important; }"""),
        # جای چاقو را خودِ کد (inline) می‌گذارد، نه CSS
        ("document.getElementById('knife-item').style.right = '8%';",
         "document.getElementById('knife-item').style.right = '2%';"),
        ("document.getElementById('knife-item').style.bottom = '38%';",
         "document.getElementById('knife-item').style.bottom = '17%';"),
        ("item.style.right = '8%';", "item.style.right = '2%';"),
        ("item.style.bottom = '38%';", "item.style.bottom = '17%';"),
        # نوبتِ چاقو: بدرخشد؛ بعد از بریدن کنار برود (وسطِ سینک جا می‌ماند)؛ بازیِ دوباره برگردد
        ("updateHint('چاقو رو بکش و ببر روی میوه!');",
         "updateHint('چاقو رو بکش و ببر روی میوه!'); "
         "document.getElementById('knife-item').classList.add('luko-attn');"),
        ("GameState.fruitSliced = true;",
         "GameState.fruitSliced = true; "
         "document.getElementById('knife-item').classList.remove('luko-attn'); "
         "document.getElementById('knife-item').classList.add('hidden');"),
        ("document.getElementById('knife-item').style.zIndex = '100';",
         "document.getElementById('knife-item').style.zIndex = '100'; "
         "document.getElementById('knife-item').classList.remove('hidden', 'luko-attn');"),
    ],
}
