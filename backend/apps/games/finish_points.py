"""
نقطه‌ی پایانِ هر بازی — جایی که بازی خودش به اپ می‌گوید «تمام شد».

بازی‌های استودیو قراردادِ اپ را نمی‌شناسند و `luko-bridge.js` پایان را از روی
صفحه حدس می‌زد. حدس در عمل بد از آب درآمد:

  - بعضی بازی‌ها هیچ‌وقت تمام نمی‌شدند (صفحه‌ی بُردشان شناسه‌ی «برد» نداشت؛
    مثلاً آزمایشگاهِ میوه‌ها نتیجه‌ی آزمون را داخلِ کارتِ سؤال می‌کشد)؛
  - بعضی با **باخت** تمام می‌شدند (مودالِ «اشتباه شد!» شناسه‌ی resultModal دارد)؛
  - بعضی با **خریدِ پوسته** در فروشگاه (مودالِ «تبریک! خرید انجام شد»)؛
  - بازی‌های چندمرحله‌ای با بُردِ همان مرحله‌ی اول.

این‌جا برای هر بازی جای دقیقِ بُرد در کدِ خودش ثبت می‌شود و `import_games`
یک صدازدن همان‌جا می‌گذارد. بازی‌ای که این‌جا باشد دیگر حدس نمی‌خورد
(`LUKO_EXPLICIT_FINISH`)؛ پل فقط برای بازیِ تازه‌ای که هنوز بررسی نشده می‌ماند.

دو صدازدن در دسترسِ بازی است (در `FINISH_HELPER`):

  lukoWin(reason)                  همین حالا بُرد
  lukoCount(count, need)           بُرد وقتی شمارِ کارهای تمام‌شده به `need` رسید
  lukoLevels(done, total, need)    بُرد وقتی `need` مرحله از `total` تمام شده؛
                                   `done` نقشه/آرایه‌ی مرحله‌های تمام‌شده‌ی
                                   خودِ بازی است (در حافظه‌ی بازی می‌ماند، پس
                                   پیشرفتِ قبلیِ بچه هم حساب می‌شود)

قاعده‌ی «چقدر بازی = یک مرحله‌ی مسیر»: پایانِ طبیعیِ خودِ بازی، مگر آن‌قدر
بلند باشد که بچه‌ی هفت‌ساله گیر کند؛ آن‌وقت چند مرحله‌ی اولش (حدودِ ۳ تا ۶
دقیقه بازی). بازی بعد از بُرد هم بازی‌کردنی می‌ماند.

هر وصله (متنِ اصلی، متنِ تازه) دقیقاً یک‌بار باید در فایل پیدا شود؛ اجرای
دوباره روی فایلِ وصله‌شده بی‌اثر است.
"""

#: کدِ کمکی که در انتهای هر بازیِ این فهرست گذاشته می‌شود
FINISH_HELPER = r"""<script>
/* لوکو: بازی خودش پایان را می‌گوید — نقطه‌اش در backend/apps/games/finish_points.py */
window.LUKO_EXPLICIT_FINISH = true;
window.lukoWin = function (reason) {
  if (window.__lukoWon) return;
  window.__lukoWon = true;
  // این بازی‌ها امتیازِ خودشان را گزارش نمی‌کنند؛ بی‌این، سرور هر بُرد را «۰ ستاره»
  // ثبت می‌کرد و مدالِ ستاره‌چین برای هیچ بچه‌ای باز نمی‌شد. بُرد = ستاره‌ی کامل
  // (سرور به سقفِ همان مرحله می‌بُرد).
  var extra = { source: 'game', reason: String(reason || 'win'), stars: 3 };
  // جشنِ خودِ بازی اول دیده شود، بعد صفحه‌ی جایزه‌ی اپ رویش بیاید
  setTimeout(function () {
    try {
      if (window.LUKO && typeof window.LUKO.finish === 'function') { window.LUKO.finish(extra); return; }
    } catch (e) { /* SDK نبود یا شکست؛ پیامِ مستقیم */ }
    try {
      window.parent.postMessage({ type: 'luko-game-complete',
        game: location.pathname.split('/').pop(), summary: extra }, '*');
    } catch (e) { /* بازی نباید به‌خاطرِ پایان بشکند */ }
  }, 1500);
};
window.lukoCount = function (count, need) {
  if (Number(count) >= need) window.lukoWin('count ' + count + '/' + need);
};
window.lukoLevels = function (done, total, need) {
  var count = 0;
  try {
    if (Array.isArray(done)) {
      done.forEach(function (v) { if (v) count += 1; });
    } else if (done) {
      Object.keys(done).forEach(function (k) {
        var n = Number(k);
        if (done[k] && n >= 1 && n <= total) count += 1;
      });
    }
  } catch (e) { return; }
  if (count >= Math.min(total, need)) window.lukoWin('levels ' + count + '/' + total);
};
</script>
"""


def at_start(signature: str, call: str) -> tuple[str, str]:
    """صدازدن در اولِ بدنه‌ی تابع: `function x(a) {` ← `function x(a) { call`"""
    return signature, f"{signature} /* لوکو */ {call}"


def before(anchor: str, call: str) -> tuple[str, str]:
    """صدازدن درست پیش از یک خطِ مشخص"""
    return anchor, f"/* لوکو */ {call} {anchor}"


def after(anchor: str, call: str) -> tuple[str, str]:
    """صدازدن درست بعد از یک خطِ مشخص"""
    return anchor, f"{anchor} /* لوکو */ {call}"


def _levels(signature: str, total: str, need: int, done: str = "levelCompleted") -> list[tuple[str, str]]:
    """خانواده‌ی «Master»: مودالِ بُردِ هر مرحله؛ تابعش فقط بعد از بُرد صدا زده می‌شود"""
    return [at_start(signature, f"lukoLevels({done}, {total}, {need});")]


FINISH: dict[str, list[tuple[str, str]]] = {
    # ---------------------------------------------------------------------
    # خانواده‌ی Master: هر مرحله یک پرسش/کارِ کوتاه، ۱۰ تا ۳۲ مرحله، مودالِ
    # winModal بعد از هر بُرد. پایان = چند مرحله‌ی اول (عدد به اندازه‌ی مرحله)
    # ---------------------------------------------------------------------
    "C1KfF2S2g2": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 4),
    "C1KoF1S2g4": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 3),
    "C1KrF15S1g1": _levels("function showWinModal(title, msg, coinReward) {", "LEVELS.length", 4),
    "C1KrF4S1g4": _levels("function showWinModal(title, msg, coinReward) {", "LEVELS.length", 5),
    "C2KrF1S1G6": _levels("function showWinModal(totalTime, coinReward) {", "totalLevels", 3),
    "C2KrF1S1G7": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 4),
    "C2KrF1S2G8": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 5),
    "C3KrF1S1G5": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 3),
    "C3KrF1S1G6": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 5),
    "C3KrF1S1G7": _levels("function showWinModal(correct, totalTime, coinReward) {", "totalLevels", 3),
    "C3KrF1S2G8": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 5),
    "C3KrF1S5G2": _levels("function showWinModal(coinReward) {", "totalLevels", 5),
    "C1KnF1S2g6": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 3),
    "C1KnF2S1g3": _levels("function showWinModal(title, msg, coinReward) {", "totalLevels", 5),
    "C3KqF1S1G1": _levels("function showWinModal(reward){", "totalLevels", 4),       # چیدنِ کلمه‌های آیه
    "C3KrF1S5G1": _levels("function showWinModal(reward){", "totalLevels", 3),       # تا، نقاشی، باز
    "C3KoF12S1G3": _levels("function showWinResult(level, reward) {", "20", 4),

    # ---------------------------------------------------------------------
    # بازی‌های «مرحله‌ی کامل شد» با فهرستِ مرحله‌های تمام‌شده (۳۰ مرحله)
    # ---------------------------------------------------------------------
    # نقاشِ کوچولو: هر مرحله یک خطِ صاف؛ فقط بعد از بُرد صدا زده می‌شوند
    "C1KnF1S1g2": [
        at_start("function showLevelCompleteWithReward(levelNum, reward) {",
                 "lukoCount(getLevelData().completed.length, 6);"),
    ],
    "C1KnF1S2g7": [
        at_start("function showLevelComplete(levelNum) {", "lukoCount(getLevelData().completed.length, 6);"),
        at_start("function showGameComplete() {", "lukoWin('all levels');"),
    ],
    # کارخانه‌ی خوراکی‌ها: هر مرحله دسته‌بندیِ همه‌ی خوراکی‌ها با زمان؛ باخت مودالِ دیگری دارد
    "C1KoF1S1g3": [
        after("document.getElementById('reward-coins').textContent = `+${reward} سکه`;",
              "lukoCount(levelData.completed.length, 3);"),
    ],
    "C1KoF3S1g1": [
        before("showResult(true, GameState.correctCount, GameState.wrongCount, ",
               "lukoCount(levelData.completed.length, 3);"),
    ],
    # سفرِ ریتم: هر مرحله یک پرسش؛ مرحله‌ها پشتِ‌سرِ هم (currentLevel = شماره‌ی همین مرحله)
    "C1KrF1S2g6": [
        at_start("function showLevelComplete() {", "lukoCount(GameState.currentLevel, 6);"),
        at_start("function showGameComplete() {", "lukoWin('all levels');"),
    ],

    # ---------------------------------------------------------------------
    # بازی‌هایی که پایانِ طبیعیِ کوتاه دارند (یک جلسه‌ی ۵ تا ۱۲ پرسش/دور)
    # ---------------------------------------------------------------------
    # ماشینِ آینده: جلسه‌ی کامل ۵ دور است؛ دورِ تکی هم در پیشرفت ثبت می‌شود
    "C3KrF1S1G1": [
        at_start("            _endGame() {",
                 "lukoCount(Object.values(this._loadProgress().completed || {}).filter(Boolean).length, 5);"),
    ],
    "C3KrF1S1G3": [at_start("            _endGame() {", "lukoWin('session');")],     # ۵ دور
    "C3KrF1S1G4": [at_start("            _endGame() {", "lukoWin('session');")],     # ۵ الگو
    "C4KrF1S1G1": [at_start("            _endGame() {", "lukoWin('session');")],     # ۵ دور
    # گنجِ آسمانی: ۸ مرحله / ۴۰ پرسش؛ پایان = ۳ مرحله‌ی قبول‌شده (دست‌کم ۲ ستاره)
    "C2KhF1S1G1": [
        at_start("function renderStageDone(){",
                 "lukoCount(Object.values(S.stars || {}).filter(function (v) { return v >= 2; }).length, 3);"),
        at_start("function showFinal(){", "lukoWin('all stages');"),
    ],
    # گل‌شمار: ۱۲ مرحله
    "C2KrF1S1G1": [
        before("queueSync('level-end',", "lukoCount(save.completed.length, 4);"),
        at_start("function finishGame(){", "lukoWin('all levels');"),
    ],
    "C2KrF1S1G8": [at_start("function finish(){", "lukoWin('all towers');")],   # ۱۰ پرسش
    "C2KrF1S1G9": [at_start("function endGame(){", "lukoWin('all levels');")],    # ۱۰ مرحله
    "C2KrF1S1G2": [at_start("            function endSession() {", "lukoWin('session');")],
    "C2KrF1S1G4": [at_start("            function endGame() {", "lukoWin('sudoku solved');")],
    # ---------------------------------------------------------------------
    # بازی‌های تکی. «n از m» یعنی بعد از n مرحله از m مرحله‌ی بازی
    # ---------------------------------------------------------------------
    # نگارش
    "C1KnF1S1g1": [at_start("function showResults(isWin) {",              # ۳ از ۳۰؛ هر مرحله ۱۵ خط
                            "if (isWin) lukoCount(getLevelData().completed.length, 3);")],
    "C1KnF1S1g3": [before("// Check if game is fully completed",             # ۴ از ۱۰
                          "lukoCount(state.completedLevels.length, 4);")],
    "C1KnF1S1g4": [before("showResultScreen(true, earnedCoins); // برد",     # ۳ از ۶
                          "lukoCount(Math.max(state.unlockedLevels - 1, currentLevelIndex + 1), 3);")],
    "C1KnF1S2g5": [after("state.gameActive = false; state.paused = true;",   # ۳ از ۷
                         "lukoCount(Math.max(state.maxUnlockedLevel - 1, state.currentLevel), 3);")],
    "C1KnF2S1g1": [before("if (state.currentLevel >= levels.length - 1) {",  # ۳ از ۲۰ جدول
                          "lukoCount(Math.max(state.unlockedLevel, state.currentLevel + 1), 3);")],
    "C1KnF2S1g2": [after("state.levelStars[state.currentLevel]=Math.max(state.levelStars[state.currentLevel]||0,stars);",
                         "lukoCount(state.completedLevels, 4);")],        # ۴ از ۲۰
    # علوم
    "C1KoF1S1g1": [at_start("function showResult(isCorrect) {",             # هر ۴ پرسش
                            "if (isCorrect) lukoCount(currentQuizIndex + 1, QUIZ_QUESTIONS.length);")],
    # آزمایشگاهِ میوه‌ها: نتیجه‌ی آزمون داخلِ کارتِ سؤال کشیده می‌شد و پل هرگز نمی‌دیدش
    "C1KoF1S1g2": [at_start("function showQuizResult(isSuccess, message, explanation) {",
                            "if (isSuccess) lukoWin('quiz');")],
    "C1KoF2S1g2": [after("localStorage.setItem('lokoMemoryLevels', JSON.stringify(levelData));",
                         "lukoCount(levelData.completed.length, 3);")],   # ۳ از ۲۹
    # قرآن
    "C1KqF1S1g1": [after("if (currentLevel === unlockedLevels) unlockedLevels++;",
                         "lukoCount(Math.max(unlockedLevels - 1, currentLevel), 3);")],
    "C1KqF1S1g2": [after("state.level = G.level + 1;", "lukoCount(G.level, 2);")],   # هر مرحله ۳ بخش
    "C1KqF1S1g3": [at_start("function completeLevel() {", "lukoCount(currentLevel, 3);")],  # ۳ از ۵
    "C1KqF1S1g4": [at_start("function showCongratsPage() {", "lukoWin('painting');")],
    # ریاضی
    "C1KrF1S1g1": [at_start("function levelComplete() {", "lukoCount(state.currentLevel, MAX_LEVEL);")],  # هر ۳
    "C1KrF1S1g2": [at_start("function completeLevel() {", "lukoCount(state.level, state.maxLevel);")],   # هر ۳
    "C1KrF1S1g3": [
        at_start("function levelComplete() {",                                 # ۳ از ۵
                 "lukoCount(gameState.completedLevels.length + (gameState.completedLevels.includes(gameState.currentLevel) ? 0 : 1), 3);"),
        at_start("function showVictoryScreen() {", "lukoWin('victory');"),
    ],
    "C1KrF1S1g4": [after("this.state.hasWonLevel = true;",                    # ۴ از ۱۰
                         "lukoCount(Math.max(parseInt(localStorage.getItem('maxUnlockedLevel') || '1', 10) - 1, this.state.level), 4);")],
    "C1KrF1S2g10": [at_start("function endGame() {", "lukoWin('all stories');")],
    "C1KrF1S2g7": [before("if (GameState.currentLevel >= savedStats.highestLevel && GameState.currentLevel < 50) {",
                          "lukoCount(savedStats.completedLevels.length, 5);")],  # ۵ از ۵۰
    "C1KrF1S2g8": [
        at_start("function levelSuccess() {", "lukoCount(currentLevel + 1, 4);"),  # ۴ از ۱۰ عدد
        at_start("function gameComplete() {", "lukoWin('all numbers');"),
    ],
    "C1KrF1S2g9": [at_start("function completeGame() {", "lukoWin('all levels');")],  # ۵ مرحله × ۳ پاسخ
    "C1KrF3S1g1": [before("const completeOverlay = document.getElementById('complete-overlay');",
                          "lukoCount(Math.max(STATE.maxUnlockedLevel - 1, STATE.currentLevel), 4);")],  # ۴ از ۱۶
    "C1KrF6S1g1": [at_start("function showActionOverlay(type) {",             # ۳ از ۵؛ «timeup» باخت است
                            "if (type === 'complete') lukoCount(Math.max(state.unlockedLevels - 1, state.currentLevel + 1), 3);")],
    "C1KrF6S1g2": [before("const isLastStage = G.stage >= MAX_STAGE;", "lukoCount(G.stage, MAX_STAGE);")],  # هر ۳
    "C1KrF8S1g1": [before("document.getElementById('game-complete').classList.add('active');",
                          "lukoWin('all animals');")],                     # هر ۵ حیوان، هرکدام یک پرسش
    "C2KfF1S1G1": [after("state.stars[G.lv]=Math.max(state.stars[G.lv]||0,stars);",
                         "lukoCount(Object.keys(state.stars).length, 3);")],  # ۳ از ۸
    "C2KnF6S1g1": [before("this.showResultModal(isWin, reason);",
                          "if (isWin) lukoCount(Object.values(this.globalStats.levelStats).filter(function (s) { return s && s.win > 0; }).length, 3);")],
    "C2KoF3S3g8": [at_start("function winParty() {", "lukoWin('bamboo grown');")],  # congratsModal خریدِ فروشگاه است
    "C2KrF1S1G3": [at_start("function completeLevel(){", "lukoCount(gameState.level, 4);")],  # ۴ از ۱۰
    "C2KrF1S1G5": [after("store.progress=Math.max(store.progress,G.num);", "lukoCount(store.progress, 3);")],  # ۳ از ۳۰
    "C3KfF2S1G1": [before("logMetrics(s,false); /* معیارهای سنجش داخلی */",
                          "if (passed) lukoCount(Object.keys(save.levels).length, 3);")],  # ۳ از ۶
    "C3KoF12S1G1": [after("stats.levelCompleted[gameState.level] = true;",
                          "lukoLevels(stats.levelCompleted, 15, 3);")],    # ۳ از ۱۵
    "C3KoF12S1G2": [after("const isWin = correctAnswers >= 2;",              # ۳ از ۱۵، هرکدام ۳ پرسش
                          "if (isWin) lukoCount(Math.max(Object.keys(unlockedLevels).filter(function (k) { return unlockedLevels[k]; }).length - 1, currentLevel), 3);")],
    "C3KrF1S1G2": [after("this.levelsDone++;", "lukoCount(this.levelsDone, 6);")],  # ۶ از ۱۲
    "C3KrF1S1G8": [at_start("function endRound(){", "lukoWin('round');")],
    "C3KrF1S1G9": [at_start("function levelDone(){", "lukoCount(G.level, 3);")],   # ۳ از ۸
    # ماشین‌حساب: دورِ ۱۰ پرسشی؛ «silent» یعنی بچه وسطش دکمه‌ی توقف را زده
    "C3KrF1S2G6": [after("const stars=data.accuracyPct>=90?3:data.accuracyPct>=60?2:1;",
                         "if (!silent && data.accuracyPct >= 50) lukoWin('round');")],
    "C3KrF1S2G7": [at_start("function showClear(wasFirst){", "lukoCount(L.lv, 10);")],  # بخشِ اول (۱۰ از ۴۰)
    "C3KrF1S3G13": [after("save.best = Math.max(save.best, level);", "lukoCount(save.best, 4);")],  # ۴ از ۲۰
    "C3KrF1S3G14": [after("S.stars[game.lvl]=Math.max(S.stars[game.lvl]||0,stars);",
                          "lukoCount(Object.keys(S.stars).length, 3);")],  # ۳ از ۱۰
    # جزیره‌ی کلمات: بازیِ باز؛ پایان = حدودِ دو دورِ خوبِ نوشتنِ کلمه
    "C4KnF1S1G2": [at_start("function showResult(finalScore) {", "lukoCount(totalScore, 16);")],
}
