"""
رابطِ سکه‌ی هر بازی — برای `luko-wallet.js`.

هر بازیِ استودیو سکه‌اش را جای دیگری نگه می‌دارد (کلیدِ خودش در
localStorage، فیلدی در ذخیره‌ی JSON، یا فقط متغیری در حافظه). رابطِ هر بازی
سه چیز را می‌گوید:

  seed  کجای localStorage (کلید، و اگر JSON است مسیرِ فیلد) — پیش از اجرای
        کدِ بازی و بعد از هر هم‌ترازی با سکه‌ی اصلی پر می‌شود؛
  get   سکه‌ی فعلیِ بازی — همان متغیری که فروشگاهِ بازی از آن کم می‌کند؛
  set   عدد را در همان متغیر می‌گذارد و نمایشِ خودِ بازی را تازه می‌کند
        (ذخیره را seed پیش از آن نوشته است).

`import_games` این‌ها را به‌صورتِ `window.LUKO_COINS` بالای هر بازی
می‌گذارد. بازیِ تازه‌ای که رابط ندارد وارد می‌شود ولی سکه‌اش جدا می‌ماند —
گزارشِ `import_games` آن را نشان می‌دهد.
"""

# رقم‌های فارسی برای بازی‌هایی که تابعِ نمایششان بسته (IIFE) است
FA = "function(n){return String(n).replace(/\\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[d];});}"


def _obj(seed: list[tuple[str, str | None]], get: str, set_: str) -> str:
    seeds = ",".join(
        f'{{key:"{k}"' + (f',path:"{p}"' if p else "") + "}" for k, p in seed
    )
    return f"{{seed:[{seeds}],get:function(){{{get}}},set:function(v){{{set_}}}}}"


def storage(key: str, refresh: str) -> str:
    """بازی هر بار سکه را از کلیدِ خودش می‌خواند؛ فقط نمایش باید تازه شود."""
    return _obj([(key, None)], f'return parseInt(localStorage.getItem("{key}"),10)||0;', refresh)


def bridge(seed: list[tuple[str, str | None]]) -> str:
    """کدِ بازی بسته است (ماژول یا IIFE)؛ وصله‌ای در GAME_PATCHES پلِ LUKO_GAME_COINS را می‌سازد."""
    return _obj(seed, "return window.LUKO_GAME_COINS.get();", "window.LUKO_GAME_COINS.set(v);")


def _bridge_code(get: str, set_: str) -> str:
    return ("/* لوکو: پلِ کیفِ مشترک به سکه‌ی این بازی (کدش بیرون دیده نمی‌شود) */ "
            f"window.LUKO_GAME_COINS = {{ get: function () {{ return {get}; }}, "
            f"set: function (v) {{ {set_} }} }};")


def memory(expr: str, refresh: str, seed: list[tuple[str, str | None]] | None = None,
           extra: str = "") -> str:
    """سکه در متغیری در حافظه است (و شاید در ذخیره‌ای که seed می‌گوید)."""
    return _obj(seed or [], f"return {expr};", f"{expr}=v;{extra}{refresh}")


MASTER = {  # خانواده‌ی «Master»: کلید + updateCoinDisplay که هر بار از کلید می‌خواند
    "C1KfF2S2g2": "findMasterCoins", "C1KnF1S2g6": "soundMasterCoins",
    "C1KnF2S1g3": "soundMasterCoins", "C1KoF1S2g4": "waterMasterCoins",
    "C1KrF15S1g1": "shareMasterCoins", "C1KrF4S1g4": "shapeMasterCoins",
    "C2KrF1S1G6": "numberBridgeCoins", "C2KrF1S1G7": "numberFactoryCoins",
    "C2KrF1S2G8": "flowerGameCoins", "C3KoF12S1G3": "eggMasterCoins",
    "C3KqF1S1G1": "quranMagicCoins", "C3KrF1S1G5": "shopkeeperCoins",
    "C3KrF1S1G6": "moneyMachineCoins", "C3KrF1S1G7": "patternBuildingCoins",
    "C3KrF1S2G8": "patternDetectiveCoins", "C3KrF1S5G1": "magicPaperCoins",
    "C3KrF1S5G2": "symmetryGameCoins",
}

ADAPTERS: dict[str, str] = {stem: storage(key, "updateCoinDisplay();") for stem, key in MASTER.items()}

ADAPTERS.update({
    # getCoins/setCoins روی کلیدِ خودشان
    "C1KnF1S1g1": storage("fc2", "updateCoinDisplay();"),
    "C1KnF1S1g2": storage("painterCoins", "updateCoinDisplay();"),
    "C1KnF1S2g7": storage("painterCoins", "updateCoinDisplay();"),
    "C1KoF1S1g2": storage("fruitGameCoins", "updateCoinDisplay();"),
    "C1KoF1S1g3": storage("foodFactoryCoins", "updateCoinDisplay();"),
    "C1KoF2S1g2": storage("lokoMemoryCoins", "updateCoinDisplay();"),
    "C1KoF3S1g1": storage("foodFactoryCoins", "updateCoinDisplay();"),
    "C1KrF1S1g4": storage("lokoCoins", "window.game&&game.updateCoinDisplay();"),
    "C3KrF1S1G2": storage("lokoCoins", "coinSystem.updateDisplay(false);"),
    "C3KrF1S1G3": storage("lokoCoins", "updateCoinDisplay(false);"),
    "C3KrF1S1G4": storage("lokoCoins", "LokoCoins.render(false);"),
    # کدِ این دو بسته (IIFE) است؛ نمایش را خودمان تازه می‌کنیم
    "C2KrF1S1G2": storage("lokoCoins",
                          f"var f={FA};['coinAmount','coinAmountGame'].forEach(function(i){{"
                          "var e=document.getElementById(i);if(e)e.textContent=f(v);});"),
    "C2KrF1S1G4": storage("lokoCoins",
                          f"var f={FA};document.querySelectorAll('.coin-amount')"
                          ".forEach(function(e){e.textContent=f(v);});"),

    # سکه در حافظه، ذخیره در کلید یا فیلدی از JSON
    "C1KnF1S1g3": memory("state.coins", "updateCoinDisplays();", [("loko-curved-line-game", "coins")]),
    "C1KnF1S1g4": memory("state.coins", "updateCoinDisplays();", [("loko_trainWritingGame_v5", "coins")]),
    "C1KnF1S2g5": memory("state.coins", "updateCoinDisplay();", [("loko_noqteyab_state", "coins")]),
    "C1KnF2S1g1": memory("state.coins", "updateCoinDisplay();", [("wordGameLOKO", "coins")]),
    "C1KnF2S1g2": memory("state.coins", "updateCoinDisplays();", [("hg_coins", None)]),
    "C1KoF1S1g1": memory("GameState.coins", "updateCoinDisplay();", [("shadowGameData", "coins")]),
    "C1KqF1S1g1": memory("coins", "updateCoins();", [("loko_neemat_yab_v2", "coins")],
                         extra="lokoCache.coins=v;"),
    "C1KqF1S1g2": memory("state.coins", "save();updateCoins();", [("loko-besmellah-game-v1", "coins")]),
    "C1KqF1S1g3": memory("shopData.coins", "saveShopData();updateAllCoinDisplays();",
                         [("salamShop_v3", "coins")]),
    "C1KqF1S1g4": memory("lokoCoins", "updateCoinUI();", [("lokoCoins", None)]),
    "C1KrF1S1g1": memory("state.coins", "updateCoinDisplays();", [("luko_active_user_cache", "coins")],
                         extra="if(typeof currentUser!=='undefined'&&currentUser)currentUser.coins=v;"),
    "C1KrF1S1g2": memory("state.coins", "updateCoinDisplay();", [("spaceTrainState", "coins")]),
    "C1KrF1S1g3": memory("currentCoins", "updateCoinDisplay();", [("magicIslandCoins", None)]),
    "C1KrF1S2g10": memory("lokoCoins", "updateCoinUI();", [("loko_coins", None)]),
    "C1KrF1S2g6": memory("GameState.lokoCoins", "updateUI();",
                         [("loko_rhythm_game_v22_auto_next", "lokoCoins")]),
    "C1KrF1S2g7": memory("savedStats.lokoCoins", "updateCoinDisplay();",
                         [("rabbitGameStatsLOKO_v17", "lokoCoins")]),
    "C1KrF1S2g8": memory("lokoCoins", "updateCoinDisplay();", [("lokoCoins", None)]),
    "C1KrF1S2g9": memory("lokoData.coins", "updateCoinDisplay();", [("lokoPlatformData", "coins")]),
    "C1KrF3S1g1": memory("STATE.coins", "updateCoinsDisplay();", [("loko_math_game", "coins")]),
    "C1KrF6S1g1": memory("state.coins", "updateCoins();", [("loko_coins", None)]),
    "C1KrF6S1g2": memory("stats.totalCoins",
                         f"saveStats(stats);refreshLanding();var e=document.getElementById('shopCoins');"
                         f"if(e)e.textContent=({FA})(v);",
                         [("balloonSubtractionStats", "totalCoins")]),
    "C1KrF8S1g1": memory("state.coins", "updateCoinDisplay();", [("jungleMathLokoV2", "coins")]),
    # این بازی کلیدِ ذخیره‌اش را تعریف نکرده (localStorage["undefined"])؛ فقط حافظه
    "C2KfF1S1G1": memory("state.coins", "save();setCoinsUI();"),
    "C2KhF1S1G1": memory("S.coins", "save();renderCoins();", [("ganj-asmani-save", "coins")]),
    "C2KnF6S1g1": memory("oceanGame.coins", "oceanGame.updateCoinDisplay();", [("oceanHunterCoins", None)]),
    "C2KoF3S3g8": bridge([("bambooCoins", None)]),
    "C2KrF1S1G1": memory("save.coins", "persist();updateCoins();", [("golshomar", "coins")]),
    "C2KrF1S1G3": memory("walletState.coins", "updateCoinDisplay(false);", [("loko_coins_v1", None)]),
    "C2KrF1S1G5": memory("store.coins", "save();updateCoins();", [("pole-number-save-v1", "coins")]),
    "C2KrF1S1G8": memory("S.coins", "updateCoins();", [("lbx_state", "coins")]),
    "C2KrF1S1G9": memory("S.coins", "save();syncCoins();", [("meveshmar", "coins")]),
    "C3KfF2S1G1": memory("save.coins", "renderCoins();", [("rahe-vazheha", "coins")]),
    "C3KoF12S1G1": memory("gameState.coins", "updateCoinDisplay();", [("towerEggCoins", None)]),
    "C3KoF12S1G2": memory("coinCount", "updateCoinDisplay();", [("insectAdventureCoins", None)]),
    "C3KrF1S1G1": memory("lokoCoins.coins", "updateCoinUI();", [("lokoCoins", None)]),
    "C3KrF1S1G8": memory("state.coins", "persist();updateCoins();", [("mahtab_save", "c")]),
    "C3KrF1S1G9": memory("coins", "updateCoins();", [("mk_coins", None)]),
    "C3KrF1S2G6": memory("state.coins", "save();updateCoins();", [("magiccar_save", "coins")]),
    "C3KrF1S2G7": memory("S.coins", "paintCoins();", [("loko_machine_v1", "coins")]),
    "C3KrF1S3G13": bridge([("tq_save_v2", "coins")]),
    "C3KrF1S3G14": memory("S.coins", "renderCoins();", [("taaron_v1", "coins")]),
    "C4KnF1S1G2": memory("coinCount", "updateCoinDisplay();", [("starWriterCoins", None)]),
    "C4KrF1S1G1": memory("lokowallet.coins", "lokowallet._render();", [("lokoCoins", None)]),
})

#: وصله‌های تک‌بازی. هر (پیدا، جایگزین) باید دقیقاً یک‌بار پیدا شود.
GAME_PATCHES: dict[str, list[tuple[str, str]]] = {
    # دو ضربه روی شمارنده سکه‌ها را صفر می‌کرد؛ حالا سکه‌ها کیفِ اصلیِ بچه‌اند
    "C4KrF1S1G1": [(
        "reset() {\n                this.coins = 0;",
        "reset() {\n                /* لوکو: سکه‌ها کیفِ اصلیِ بچه‌اند؛ صفرکردنِ دستی خاموش است */ return;\n"
        "                this.coins = 0;",
    )],
    # پلِ LUKO_GAME_COINS برای بازی‌هایی که رابطشان bridge است
    # <script type="module">: «coins» و توابعش بیرون از ماژول دیده نمی‌شوند
    "C2KoF3S3g8": [(
        "        } catch(e) {}\n\n        // === Shop Data (with Music) ===",
        "        } catch(e) {}\n        " + _bridge_code("coins", "coins = v; saveCoins();")
        + "\n\n        // === Shop Data (with Music) ===",
    )],
    # همه‌ی کد داخلِ یک IIFE است
    "C3KrF1S3G13": [(
        "const persist = ()=>store.set('tq_save_v2', save);\n",
        "const persist = ()=>store.set('tq_save_v2', save);\n"
        + _bridge_code("save.coins", "save.coins = v; persist(); updateCoins();") + "\n",
    )],
}
