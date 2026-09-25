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
    "C1KnF2S3G1": [
        # پیامِ بالای صفحه («مرحله ۱ — …») سه ثانیه روی ردیفِ اولِ موج‌ها می‌نشست و
        # ضربه‌ی بچه را می‌گرفت؛ حالا ضربه از آن رد می‌شود
        _css(".toast { pointer-events: none; }"),
        # آمارش را در همان کلیدِ نسخه‌ی قبلیِ همین بازی (C2KnF6S1g1) می‌نوشت؛ بُردهای
        # یکی مرحله‌های دیگری را «بُرده» نشان می‌داد و پایانش را جلو می‌انداخت
        ("localStorage.getItem('letterSGameStats')", "localStorage.getItem('letterSGameStats_C1KnF2S3G1')"),
        ("localStorage.setItem('letterSGameStats'", "localStorage.setItem('letterSGameStats_C1KnF2S3G1'"),
    ],
    # شمارشِ میوه: نوشته‌های صفحه انگلیسی بود (Back، Stop، Level، Group، Coins، Buy…)
    # و عددها لاتین — بچه‌ی کلاسِ دوم رقمِ فارسی می‌خواند. فروشگاه «آ» نداشت (ابی، اتشفشان).
    "C2KrF1S1G11": [
        ("Back\n      </button>\n      <h2 class=\"page-title\">Help</h2>",
         "برگشت\n      </button>\n      <h2 class=\"page-title\">راهنما</h2>"),
        ("Back\n    </button>\n  </section>", "برگشت\n    </button>\n  </section>"),
        ("Back\n      </button>\n      <h2 class=\"page-title\">Shop</h2>",
         "برگشت\n      </button>\n      <h2 class=\"page-title\">فروشگاه</h2>"),
        ("        Stop\n      </button>", "        توقف\n      </button>"),
        ('<div class="level-label" id="levelLabel">Level 1 / 10</div>',
         '<div class="level-label" id="levelLabel">مرحله‌ی ۱ از ۱۰</div>'),
        ('<span id="levelEarned">+3 Coins</span>', '<span id="levelEarned">+۳ سکه</span>'),
        ('<span id="winEarned">+0 Coins</span>', '<span id="winEarned">+۰ سکه</span>'),
        ("<h2>افرین!</h2>", "<h2>آفرین!</h2>"),
        ("Please enable JavaScript.", "برای بازی، جاوااسکریپت را روشن کن."),
        ('$("levelLabel").textContent = "Level " + this.level + " / " + MAX_LEVEL;',
         '$("levelLabel").textContent = "مرحله‌ی " + faNum(this.level) + " از " + faNum(MAX_LEVEL);'),
        ("'<span class=\"group-tag\">Group ' + (i + 1) + \"</span>\" +",
         "'<span class=\"group-tag\">دسته‌ی ' + faNum(i + 1) + \"</span>\" +"),
        ("      b.textContent = n;\n", "      b.textContent = faNum(n);\n"),
        ("'<span class=\"slot-num\">' + num + \"</span>\" +", "'<span class=\"slot-num\">' + faNum(num) + \"</span>\" +"),
        ('floatCoin(slot, "+" + COIN_PER_CORRECT);', 'floatCoin(slot, "+" + faNum(COIN_PER_CORRECT));'),
        ('$("winEarned").textContent = "+" + this.levelEarned + " Coins";',
         '$("winEarned").textContent = "+" + faNum(this.levelEarned) + " سکه";'),
        ('$("levelDoneSub").textContent = "تو تموم کردی مرحله " + this.level;',
         '$("levelDoneSub").textContent = "مرحله‌ی " + faNum(this.level) + " رو تموم کردی!";'),
        ('$("levelEarned").textContent = "+" + this.levelEarned + " Coins";',
         '$("levelEarned").textContent = "+" + faNum(this.levelEarned) + " سکه";'),
        ('function refreshCoins() {\n  $("coinsMenu").textContent = Store.data.coins;\n'
         '  $("coinsGame").textContent = Store.data.coins;\n  $("coinsShop").textContent = Store.data.coins;',
         'function refreshCoins() {\n  $("coinsMenu").textContent = faNum(Store.data.coins);\n'
         '  $("coinsGame").textContent = faNum(Store.data.coins);\n  $("coinsShop").textContent = faNum(Store.data.coins);'),
        ("' + item.price + \"</span>\" + action + \"</div>\";", "' + faNum(item.price) + \"</span>\" + action + \"</div>\";"),
        ('disabled>Active ✓</button>', 'disabled>فعال ✓</button>'),
        ('\'">Equip</button>\'', '\'">انتخاب</button>\''),
        ('\'">Buy</button>\'', '\'">خرید</button>\''),
        ("toast('\"' + item.name + '\" purchased! 🎉');", "toast('«' + item.name + '» خریدی! 🎉');"),
        ('toast("Not enough coins! Count more fruits to earn coins 🍎");',
         'toast("سکه‌ات کافی نیست! میوه‌های بیشتری بشمار تا سکه بگیری 🍎");'),
        ('desc: "خط های ابی"', 'desc: "خط‌های آبی"'),
        ('name: "ابنباتی"', 'name: "آبنباتی"'),
        ('name: "اتشفشان"', 'name: "آتشفشان"'),
        ('name: "گلکسی"', 'name: "کهکشان"'),
        ('desc: "رنگ قهرمان ها"', 'desc: "رنگِ قهرمان‌ها"'),
        ('desc: "سبز و ارام"', 'desc: "سبز و آرام"'),
        ('desc: " ابی و درخشان"', 'desc: "آبی و درخشان"'),
        ('name: " دنیای افتابی"', 'name: "دنیای آفتابی"'),
        ('desc: "رنگ های روشن"', 'desc: "رنگ‌های روشن"'),
        ('desc: "میوه های خوشحال"', 'desc: "میوه‌های خوشحال"'),
        ('name: "ستاره دار"', 'name: "ستاره‌دار"'),
        ('desc: "چشمک زن"', 'desc: "چشمک‌زن"'),
        # رقمِ فارسی برای همه‌ی عددهای بالا
        ('function randInt(a, b) {', "const faNum = (n) => String(n).replace(/\\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);\n"
                                     'function randInt(a, b) {'),
    ],
    # کارخانه‌ی صداها: شماره‌ی قدم‌های راهنما سمتِ چپ (inline-end در راست‌به‌چپ) روی
    # انتهای متن می‌افتاد، در حالی که جایش سمتِ راست خالی مانده بود؛ رقم‌ها هم لاتین بودند
    "C4KfF1S2G1": [
        _css(".h-steps li::before { inset-inline-end: auto !important; inset-inline-start: 0 !important;"
             " content: counter(st, persian) !important; }"),
    ],
    "C1KrF4S1G1": [
        # آمارِ پنهانِ هر پاسخ بی‌سقف در حافظه‌ی مرورگر جمع می‌شد
        ("stats.answers.push({lv: curLv + 1, q: qIndex + 1, ok, ms});",
         "stats.answers.push({lv: curLv + 1, q: qIndex + 1, ok, ms}); "
         "if (stats.answers.length > 300) stats.answers.splice(0, stats.answers.length - 300);"),
        # موجودی فقط در سربرگِ سایت دیده می‌شود (coin_display.py)، نه وسطِ پیام
        ("`هر ۱۰ مرحله رو تمام کردی و ${fa(S.coins)} سکه داری!`", "`هر ۱۰ مرحله رو تمام کردی!`"),
    ],
    "C2KrF1S1G8": [
        ("؛ تو ${fa(S.coins)} سکه داری. با تموم کردن بازی جمعش کن!`", "؛ سکه‌هات کافی نیست. با تموم کردن بازی جمعش کن!`"),
    ],
}

# نجاتِ قبیله: صفِ همگام‌سازی نشانیِ سرور ندارد و هیچ‌وقت خالی نمی‌شود؛ بی‌سقف
# حافظه‌ی مرورگر را پر می‌کرد (همان کلیدی که چهار بازیِ دیگر هم دارند)
for _stem in ("C1KrF1S1G5", "C1KrF1S1G6", "C2KrF1S1G10"):
    FIXES[_stem] = [("q.push(item);", "q.push(item); if (q.length > 50) q.splice(0, q.length - 50);")]
