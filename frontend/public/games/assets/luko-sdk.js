/**
 * LUKO Game SDK v2 — چرخهٔ عمرِ مشترکِ همهٔ بازی‌ها.
 *
 * ------------------------------------------------------------------
 * چرا این لایه هست
 * ------------------------------------------------------------------
 * هر بازیِ لوکو یک فایلِ HTML مستقل است و منطقِ مرحله‌بندی‌اش را خودش
 * دارد — با اسم‌های متفاوت (`currentLevel`, `state.level`, `G.stage`, …).
 * پلتفرم از آن چیزی نمی‌دید جز یک پیامِ «تمام شد». نتیجه‌اش دو مشکل بود:
 *
 *   ۱. بازیِ چندمرحله‌ای بعدِ مرحلهٔ اول «تمام‌شده» حساب می‌شد، چون
 *      `finish()` داخلِ `levelComplete()` صدا زده می‌شد.
 *   ۲. پنل والدین هیچ دیدی به سطحِ مرحله نداشت: نه زمانِ مرحله، نه
 *      خطای مرحله، نه اینکه بچه کجا گیر کرده.
 *
 * پس اینجا یک ماشینِ حالتِ مشترک نشسته که «پایانِ مرحله» را از «پایانِ
 * بازی» جدا می‌کند و زمان/امتیاز/خطا را در هر دو سطح نگه می‌دارد.
 *
 * ------------------------------------------------------------------
 * سازگاریِ عقب‌رو — عمدی
 * ------------------------------------------------------------------
 * ۲۷ بازیِ زنده همین فایل را بار می‌کنند و فقط `answer` و `finish` را
 * صدا می‌زنند. بازی‌ای که `LUKO.init()` را صدا نزند **دقیقاً مثل قبل**
 * کار می‌کند. چرخهٔ عمر فقط وقتی روشن می‌شود که بازی خودش را معرفی کند.
 * مهاجرت هر بازی می‌شود دو خط: یک `init()` و تبدیلِ `finish()` به
 * `levelComplete()`.
 *
 * ------------------------------------------------------------------
 * ماشینِ حالت
 * ------------------------------------------------------------------
 *   CREATED → READY → PLAYING ⇄ PAUSED
 *                        ↓
 *                   LEVEL_ENDED ──(مرحلهٔ دیگری مانده)──→ PLAYING
 *                        │
 *                        └──(آخرین مرحله برده شد)──→ COMPLETED
 *   PLAYING/LEVEL_ENDED ──(باخت قطعی)──→ GAME_OVER
 *   هر حالتِ غیرِپایانی ──(ترکِ بازی)──→ ABANDONED
 *
 * فقط و فقط `COMPLETED` پیامِ `luko-game-complete` می‌فرستد — یعنی همان
 * چیزی که سکه می‌دهد و مرحلهٔ سیزن را تیک می‌زند. `GAME_OVER` و
 * `ABANDONED` با `luko-game-progress` می‌روند: داده ثبت می‌شود، جایزه نه.
 *
 * ------------------------------------------------------------------
 * API
 * ------------------------------------------------------------------
 *   LUKO.init({ gameType, totalLevels })   معرفیِ بازی  → READY
 *   LUKO.startGame()                       منو → بازی    → PLAYING
 *   LUKO.startLevel(index, meta)           شروعِ مرحله
 *   LUKO.answer({ topic, correct, ms })    هر پاسخ
 *   LUKO.hint(topic)                       راهنمایی گرفت
 *   LUKO.mistake(info)                     خطایی که پاسخ نیست
 *   LUKO.levelComplete({ score })          مرحله برده شد
 *   LUKO.levelFailed({ reason })           مرحله باخته شد (قابلِ تکرار)
 *   LUKO.pause() / LUKO.resume()           ساعت
 *   LUKO.gameOver({ reason })              باختِ قطعیِ کلِ بازی
 *   LUKO.finish(extra)                     پایانِ بازی (نگهبانی‌شده)
 *   LUKO.snapshot()                        مدلِ دادهٔ فعلی
 *   LUKO.on(fn)                            اشتراک برای UI
 */
(function () {
  'use strict';

  var SCHEMA = 2;
  /** بی‌حرکتیِ بیش از این، «رهاکردن» حساب می‌شود */
  var IDLE_MS = 30000;

  var STATE = {
    CREATED: 'CREATED',
    READY: 'READY',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    LEVEL_ENDED: 'LEVEL_ENDED',
    COMPLETED: 'COMPLETED',
    GAME_OVER: 'GAME_OVER',
    ABANDONED: 'ABANDONED',
  };

  /** گذارهای مجاز. هر چیزِ دیگری بی‌صدا رد می‌شود تا بازی نشکند. */
  var ALLOWED = {
    CREATED: ['READY', 'PLAYING', 'ABANDONED'],
    READY: ['PLAYING', 'ABANDONED'],
    PLAYING: ['PAUSED', 'LEVEL_ENDED', 'COMPLETED', 'GAME_OVER', 'ABANDONED'],
    PAUSED: ['PLAYING', 'ABANDONED', 'GAME_OVER'],
    LEVEL_ENDED: ['PLAYING', 'COMPLETED', 'GAME_OVER', 'ABANDONED'],
    COMPLETED: [],
    GAME_OVER: [],
    ABANDONED: [],
  };

  var TERMINAL = { COMPLETED: 1, GAME_OVER: 1, ABANDONED: 1 };

  // ==================================================================
  // Transport — تنها جایی که با اپ حرف می‌زند
  // ==================================================================
  var slug = (function () {
    var name = (location.pathname.split('/').pop() || '').replace(/\.html?$/, '');
    return decodeURIComponent(name);
  })();

  var sessionId = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function post(type, body) {
    try {
      var payload = { type: type, game: slug, sessionId: sessionId };
      for (var k in body) if (Object.prototype.hasOwnProperty.call(body, k)) payload[k] = body[k];
      window.parent.postMessage(payload, window.location.origin);
    } catch { /* بازی نباید به‌خاطرِ تله‌متری بشکند */ }
  }

  // ==================================================================
  // Clock — ساعتِ بازی و ساعتِ مرحله، هر دو مکث‌آگاه
  // ==================================================================
  /**
   * دو زمان نگه می‌داریم: `elapsed` (از شروع تا حالا) و `active`
   * (بدونِ مکث). مدتِ فعال معیارِ درست‌تری برای «چقدر واقعاً بازی کرد»
   * است؛ بچه تبِ مرورگر را باز می‌گذارد و می‌رود.
   */
  function Clock() {
    this.startedAt = 0;
    this.endedAt = 0;
    this.pausedAt = 0;
    this.pausedMs = 0;
  }
  Clock.prototype.start = function () {
    this.startedAt = Date.now();
    this.endedAt = 0;
    this.pausedAt = 0;
    this.pausedMs = 0;
    return this;
  };
  Clock.prototype.pause = function () {
    if (this.startedAt && !this.pausedAt && !this.endedAt) this.pausedAt = Date.now();
  };
  Clock.prototype.resume = function () {
    if (this.pausedAt) {
      this.pausedMs += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
  };
  Clock.prototype.stop = function () {
    if (!this.startedAt) return;
    this.resume();
    if (!this.endedAt) this.endedAt = Date.now();
  };
  Clock.prototype.elapsedMs = function () {
    if (!this.startedAt) return 0;
    return (this.endedAt || Date.now()) - this.startedAt;
  };
  Clock.prototype.activeMs = function () {
    var paused = this.pausedMs + (this.pausedAt ? Date.now() - this.pausedAt : 0);
    return Math.max(0, this.elapsedMs() - paused);
  };

  // ==================================================================
  // Stats — انباشتِ پاسخ/خطا/راهنما، هم کلی هم برایِ مرحلهٔ جاری
  // ==================================================================
  function Stats() {
    this.asked = 0;
    this.correct = 0;
    this.hints = 0;
    this.mistakes = 0;
    this.attempts = 0;
    this.score = 0;
    this.totalAnswerMs = 0;
    this.answerTimes = [];
  }
  Stats.prototype.accuracy = function () {
    return this.asked ? Math.round((this.correct / this.asked) * 100) : 0;
  };
  Stats.prototype.avgMs = function () {
    return this.asked ? Math.round(this.totalAnswerMs / this.asked) : 0;
  };

  function median(list) {
    if (!list.length) return 0;
    var s = list.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }

  // ==================================================================
  // Session — کلِ حالتِ بازی. هیچ DOMی نمی‌شناسد.
  // ==================================================================
  var S = {
    schema: SCHEMA,
    slug: slug,
    sessionId: sessionId,
    gameId: slug,
    gameType: '',
    status: STATE.CREATED,
    declared: false,          // init() صدا زده شده؟
    startEmitted: false,      // game_start رفته؟ (مسیرِ نسخهٔ ۱)
    totalLevels: 1,
    currentLevel: 0,          // ۰ یعنی هنوز مرحله‌ای شروع نشده
    levels: [],               // یک ردیف به‌ازای هر مرحلهٔ شروع‌شده
    clock: new Clock(),
    totals: new Stats(),
    topics: {},
    idlePeriods: 0,
    lastActivity: Date.now(),
    finalized: false,
    listeners: [],
  };

  /** مرحلهٔ در حالِ اجرا، یا null */
  function activeLevel() {
    var lvl = S.levels[S.levels.length - 1];
    return lvl && !lvl.endedAt ? lvl : null;
  }

  function notify() {
    var snap = snapshot();
    for (var i = 0; i < S.listeners.length; i++) {
      try { S.listeners[i](snap); } catch { /* UIِ بازی نباید منطق را ببرد */ }
    }
  }

  /**
   * تنها راهِ عوض‌شدنِ حالت. گذارِ غیرمجاز را بی‌صدا رد می‌کند تا یک
   * صدازدنِ اشتباه در بازی، کلِ جلسه را خراب نکند.
   */
  function go(next, reason) {
    if (S.status === next) return true;
    var allowed = ALLOWED[S.status] || [];
    if (allowed.indexOf(next) === -1) {
      emit('state_rejected', { from: S.status, to: next, reason: reason || '' });
      return false;
    }
    // گذارِ موفق فقط به مشترکانِ محلی خبر داده می‌شود، نه به سرور:
    // `level_start` و `level_end` همین را با جزئیاتِ بیشتر می‌گویند و
    // در بازیِ ۳۰ مرحله‌ای این می‌شد ۶۰ رویدادِ تکراری.
    // گذارِ *رد‌شده* اما سیگنالِ باگ است و باید برود.
    S.status = next;
    notify();
    return true;
  }

  // ==================================================================
  // Events — یک شکلِ واحد برای همهٔ رویدادها
  // ==================================================================
  /**
   * هر رویداد این چهار چیز را همیشه دارد: کِی، در چه حالتی، در چه
   * مرحله‌ای، و امتیازِ آن لحظه. تحلیلِ پنل والدین روی همین‌ها بسته
   * می‌شود؛ رویدادِ بی‌زمینه بعداً قابلِ تحلیل نیست.
   */
  function emit(type, data) {
    var lvl = activeLevel();
    var e = {
      type: type,
      at: new Date().toISOString(),
      status: S.status,
      level: S.currentLevel || null,
      levelId: lvl ? lvl.id : null,
      score: S.totals.score,
    };
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) e[k] = data[k];
    post('luko-game-event', { event: e });
  }

  /**
   * بازیِ نسخهٔ ۱ هیچ‌وقت `startGame` نمی‌زند. به‌جای شلیکِ کورِ
   * `game_start` هنگامِ بارگذاری، آن را به اولین تعاملِ واقعی گره می‌زنیم:
   *
   *   - شلیکِ هنگامِ بارگذاری هر بار بازکردن و بستنِ فوری را هم یک «شروع»
   *     می‌شمرد و آمارِ پنل والدین را باد می‌کرد.
   *   - و اگر بازی بعداً `init()` صدا می‌زد، دو `game_start` ثبت می‌شد.
   *
   * ساعت از بارگذاری می‌رود (مدت باید درست باشد)، ولی رویداد از اولین
   * حرکتِ بچه.
   */
  function ensureStarted() {
    if (S.declared || S.startEmitted || TERMINAL[S.status]) return;
    S.startEmitted = true;
    if (S.status === STATE.CREATED) S.status = STATE.PLAYING;
    emit('game_start', { at: new Date().toISOString(), legacy: true });
  }

  function touch() {
    var now = Date.now();
    if (now - S.lastActivity > IDLE_MS) {
      S.idlePeriods++;
      emit('idle', { ms: now - S.lastActivity });
    }
    S.lastActivity = now;
  }

  // ==================================================================
  // Model — عکسِ لحظه‌ایِ داده، همان چیزی که به بک‌اند می‌رود
  // ==================================================================
  function levelRows() {
    return S.levels.map(function (l) {
      return {
        index: l.index,
        id: l.id,
        title: l.title || '',
        startedAt: l.startedAt,
        endedAt: l.endedAt || null,
        durationMs: l.clock.activeMs(),
        status: l.status,
        score: l.stats.score,
        asked: l.stats.asked,
        correct: l.stats.correct,
        mistakes: l.stats.mistakes,
        attempts: l.stats.attempts,
        hints: l.stats.hints,
        accuracy: l.stats.accuracy(),
        avgAnswerMs: l.stats.avgMs(),
      };
    });
  }

  function topicRows() {
    var out = {};
    for (var key in S.topics) {
      var t = S.topics[key];
      out[key] = {
        label: t.label || key,
        asked: t.asked,
        correct: t.correct,
        accuracy: t.asked ? Math.round((t.correct / t.asked) * 100) : 0,
        avgMs: t.asked ? Math.round(t.ms / t.asked) : 0,
        hints: t.hints,
      };
    }
    return out;
  }

  function snapshot(extra) {
    var t = S.totals;
    var out = {
      schema: SCHEMA,
      sessionId: S.sessionId,
      gameId: S.gameId,
      gameSlug: S.slug,
      gameType: S.gameType,
      status: S.status,

      totalLevels: S.totalLevels,
      currentLevel: S.currentLevel,
      levelsCompleted: S.levels.filter(function (l) { return l.status === 'passed'; }).length,
      progress: S.totalLevels
        ? Math.round((S.levels.filter(function (l) { return l.status === 'passed'; }).length / S.totalLevels) * 100)
        : 0,

      startedAt: S.clock.startedAt ? new Date(S.clock.startedAt).toISOString() : null,
      endedAt: S.clock.endedAt ? new Date(S.clock.endedAt).toISOString() : null,
      durationMs: S.clock.elapsedMs(),
      activeMs: S.clock.activeMs(),

      score: t.score,
      asked: t.asked,
      correct: t.correct,
      errors: t.asked - t.correct,
      mistakes: t.mistakes,
      attempts: t.attempts,
      hints: t.hints,
      accuracy: t.accuracy(),
      avgAnswerMs: t.avgMs(),
      medianAnswerMs: median(t.answerTimes),
      idlePeriods: S.idlePeriods,

      levels: levelRows(),
      topics: topicRows(),
      device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  // ==================================================================
  // Levels
  // ==================================================================
  function openLevel(index, meta) {
    meta = meta || {};
    var lvl = {
      index: index,
      id: meta.id || String(index),
      title: meta.title || '',
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'playing',
      clock: new Clock().start(),
      stats: new Stats(),
    };
    S.levels.push(lvl);
    S.currentLevel = index;
    emit('level_start', { index: index, id: lvl.id, title: lvl.title });
    notify();
    return lvl;
  }

  function closeLevel(status, extra) {
    var lvl = activeLevel();
    if (!lvl) return null;
    lvl.clock.stop();
    lvl.endedAt = new Date().toISOString();
    lvl.status = status;
    if (extra && typeof extra.score === 'number') {
      lvl.stats.score = extra.score;
      S.totals.score += extra.score;
    }
    emit('level_end', {
      index: lvl.index,
      id: lvl.id,
      result: status,
      durationMs: lvl.clock.activeMs(),
      levelScore: lvl.stats.score,
      asked: lvl.stats.asked,
      correct: lvl.stats.correct,
      mistakes: lvl.stats.mistakes,
      hints: lvl.stats.hints,
    });
    return lvl;
  }

  /** آیا مرحلهٔ دیگری مانده؟ تنها جایی که پایانِ بازی تصمیم گرفته می‌شود. */
  function hasMoreLevels() {
    return S.currentLevel < S.totalLevels;
  }

  // ==================================================================
  // Finalize — یک‌بار، و فقط یک‌بار
  // ==================================================================
  /**
   * پایانِ جلسه. `COMPLETED` جایزه‌آور است و با `luko-game-complete`
   * می‌رود؛ بقیه با `luko-game-progress` که فقط داده ثبت می‌کند.
   */
  function finalize(extra) {
    if (S.finalized) return;
    S.finalized = true;
    S.clock.stop();

    var won = S.status === STATE.COMPLETED;
    var payload = snapshot(extra);
    payload.completed = won;
    if (!won) payload.abandoned = S.status === STATE.ABANDONED;

    emit('results_finalized', { result: S.status, durationMs: payload.durationMs, score: payload.score });
    post(won ? 'luko-game-complete' : 'luko-game-progress', { summary: payload });
    notify();
  }

  // ==================================================================
  // API
  // ==================================================================
  var LUKO = {
    STATE: STATE,

    /**
     * معرفیِ بازی. بدونِ این، SDK در حالتِ سازگاریِ نسخهٔ ۱ می‌ماند و
     * `finish()` مثلِ قبل یعنی «بازی تمام شد».
     */
    init: function (config) {
      config = config || {};
      S.declared = true;
      S.gameId = config.gameId || slug;
      S.gameType = config.gameType || '';
      S.totalLevels = Math.max(1, parseInt(config.totalLevels, 10) || 1);

      /**
       * `init` باید همیشه بگیرد، حتی اگر دیر صدا زده شود.
       *
       * بوتِ سازگاریِ نسخهٔ ۱ روی `load` بازی را به PLAYING می‌برد. بازی‌ای
       * که `init` را داخلِ یک هندلرِ دیرتر صدا بزند، با ماشینِ حالتِ سخت‌گیر
       * بی‌صدا از چرخهٔ عمر جا می‌ماند و باگش تا پنل والدین می‌رفت. پس تا
       * وقتی هیچ اتفاقِ واقعی نیفتاده (نه مرحله‌ای، نه پاسخی) اجازه می‌دهیم
       * جلسه به READY برگردد و ساعت از نو شروع شود.
       */
      var untouched = !S.levels.length && !S.totals.asked && !TERMINAL[S.status];
      if (untouched) {
        S.status = STATE.READY;
        S.clock = new Clock();
      }
      emit('game_ready', { gameType: S.gameType, totalLevels: S.totalLevels, rebased: untouched });
      notify();
      return LUKO;
    },

    /** منو → بازی. ساعتِ بازی از این‌جا شروع می‌شود، نه از بارگذاریِ فایل. */
    startGame: function (meta) {
      if (S.status === STATE.PLAYING || TERMINAL[S.status]) return LUKO;
      S.declared = true;              // جلوی game_startِ خودکار را می‌گیرد
      S.startEmitted = true;
      S.clock.start();
      go(STATE.PLAYING, 'startGame');
      emit('game_start', (meta || {}));
      return LUKO;
    },

    /**
     * شروعِ یک مرحله. اگر مرحلهٔ بازی باز مانده باشد، بی‌نتیجه بسته
     * می‌شود تا زمانِ دو مرحله روی هم نیفتد.
     */
    startLevel: function (index, meta) {
      if (!S.clock.startedAt) LUKO.startGame();
      if (activeLevel()) closeLevel('interrupted');
      if (S.status === STATE.LEVEL_ENDED) go(STATE.PLAYING, 'nextLevel');
      var n = parseInt(index, 10);
      openLevel(isNaN(n) ? S.currentLevel + 1 : n, meta);
      return LUKO;
    },

    /** هر پاسخِ بچه — قلبِ گزارشِ والدین */
    answer: function (data) {
      data = data || {};
      ensureStarted();
      touch();
      var ms = typeof data.ms === 'number' ? data.ms : (Date.now() - S.lastActivity);
      var topic = data.topic || 'general';
      var correct = !!data.correct;
      var lvl = activeLevel();

      // `mistakes` فقط خطای غیرِپاسخ است (تیله افتاد، وقت تمام شد).
      // پاسخِ غلط از `asked - correct` درمی‌آید؛ در هر دو شمردنش، عددِ
      // «خطا» را در گزارشِ والدین دو برابر نشان می‌داد.
      [S.totals, lvl && lvl.stats].forEach(function (st) {
        if (!st) return;
        st.asked++;
        st.attempts += data.attempt || 1;
        if (correct) st.correct++;
        st.totalAnswerMs += ms;
        st.answerTimes.push(ms);
      });

      if (!S.topics[topic]) {
        S.topics[topic] = { label: data.topicLabel || topic, asked: 0, correct: 0, ms: 0, hints: 0 };
      }
      var t = S.topics[topic];
      t.asked++;
      t.ms += ms;
      if (correct) t.correct++;

      emit('answer', {
        topic: topic,
        correct: correct,
        ms: ms,
        attempt: data.attempt || 1,
        hintUsed: !!data.hintUsed,
        tier: typeof data.tier !== 'undefined' ? data.tier : S.currentLevel,
        given: data.given,
        expected: data.expected,
      });
      notify();
      return LUKO;
    },

    /** بچه راهنمایی خواست — نشانهٔ «مفهوم را کامل نگرفته» */
    hint: function (topic) {
      ensureStarted();
      touch();
      var lvl = activeLevel();
      S.totals.hints++;
      if (lvl) lvl.stats.hints++;
      var key = topic || 'general';
      if (S.topics[key]) S.topics[key].hints++;
      emit('hint', { topic: key });
      notify();
      return LUKO;
    },

    /** خطایی که پاسخ نیست — تیله افتاد، مسیر غلط رفت، وقت تمام شد */
    mistake: function (info) {
      ensureStarted();
      touch();
      var lvl = activeLevel();
      S.totals.mistakes++;
      if (lvl) lvl.stats.mistakes++;
      emit('mistake', info || {});
      notify();
      return LUKO;
    },

    /** امتیازِ دلخواهِ خودِ بازی */
    addScore: function (points) {
      var n = Number(points) || 0;
      var lvl = activeLevel();
      S.totals.score += n;
      if (lvl) lvl.stats.score += n;
      notify();
      return LUKO;
    },

    /**
     * مرحله برده شد. **این پایانِ بازی نیست.**
     * اگر مرحلهٔ دیگری مانده باشد فقط `LEVEL_ENDED` می‌شویم و منتظرِ
     * `startLevel` بعدی می‌مانیم؛ اگر آخرین مرحله بود، بازی تمام است.
     */
    levelComplete: function (extra) {
      if (TERMINAL[S.status]) return LUKO;
      closeLevel('passed', extra);
      if (hasMoreLevels()) {
        go(STATE.LEVEL_ENDED, 'levelComplete');
        return LUKO;
      }
      go(STATE.COMPLETED, 'lastLevelComplete');
      finalize(extra);
      return LUKO;
    },

    /** مرحله باخته شد ولی بازی ادامه دارد — بچه دوباره تلاش می‌کند */
    levelFailed: function (info) {
      if (TERMINAL[S.status]) return LUKO;
      closeLevel('failed', info);
      go(STATE.LEVEL_ENDED, 'levelFailed');
      return LUKO;
    },

    pause: function (reason) {
      if (S.status !== STATE.PLAYING) return LUKO;
      S.clock.pause();
      var lvl = activeLevel();
      if (lvl) lvl.clock.pause();
      go(STATE.PAUSED, reason || 'pause');
      emit('pause', { reason: reason || '' });
      return LUKO;
    },

    resume: function () {
      if (S.status !== STATE.PAUSED) return LUKO;
      S.clock.resume();
      var lvl = activeLevel();
      if (lvl) lvl.clock.resume();
      go(STATE.PLAYING, 'resume');
      emit('resume', {});
      return LUKO;
    },

    /** باختِ قطعی — داده ثبت می‌شود، جایزه نه */
    gameOver: function (info) {
      if (TERMINAL[S.status]) return LUKO;
      if (activeLevel()) closeLevel('failed', info);
      if (!go(STATE.GAME_OVER, 'gameOver')) return LUKO;
      emit('game_over', info || {});
      finalize(info);
      return LUKO;
    },

    /** بچه وسطِ کار رفت */
    abandon: function (reason) {
      if (TERMINAL[S.status]) return LUKO;
      if (activeLevel()) closeLevel('abandoned');
      if (!go(STATE.ABANDONED, reason || 'abandon')) return LUKO;
      emit('game_abandoned', { reason: reason || '' });
      finalize({});
      return LUKO;
    },

    /**
     * پایانِ بازی.
     *
     * نگهبانِ اصلی همین‌جاست: اگر بازی خودش را با `totalLevels` معرفی
     * کرده باشد و هنوز مرحله مانده باشد، این صدازدن به «پایانِ مرحله»
     * تنزل پیدا می‌کند. بازی‌های قدیمی `finish()` را داخلِ
     * `levelComplete()` صدا می‌زدند و همین باعث می‌شد بعدِ مرحلهٔ اول
     * کلِ بازی تمام‌شده حساب شود.
     */
    finish: function (extra) {
      if (TERMINAL[S.status]) return LUKO;
      ensureStarted();

      if (S.declared && hasMoreLevels() && S.currentLevel > 0) {
        emit('finish_deferred', { level: S.currentLevel, totalLevels: S.totalLevels });
        return LUKO.levelComplete(extra);
      }

      if (!S.clock.startedAt) S.clock.start();   // بازی‌ای که startGame نزده
      if (activeLevel()) closeLevel('passed', extra);
      // بازیِ نسخهٔ ۱ که قبل از `load` تمام شده و هنوز CREATED است
      if (S.status === STATE.CREATED || S.status === STATE.READY) S.status = STATE.PLAYING;
      go(STATE.COMPLETED, 'finish');
      finalize(extra);
      return LUKO;
    },

    /** مدلِ دادهٔ فعلی — همان چیزی که ارسال می‌شود */
    snapshot: function () { return snapshot({}); },

    /** برای UIِ خودِ بازی: هر تغییرِ حالت را بشنو */
    on: function (fn) {
      if (typeof fn === 'function') S.listeners.push(fn);
      return LUKO;
    },

    /** رویدادِ دلخواهِ خودِ بازی */
    event: function (type, data) {
      touch();
      emit(type, data || {});
      return LUKO;
    },

    // ---- سازگاری با نسخهٔ ۱ ----
    /** قدیمی: شروعِ یک ایستگاه. حالا معادلِ startLevel است. */
    stage: function (name, index) {
      return LUKO.startLevel(index, { title: name });
    },
    /** قدیمی: خلاصهٔ جلسه */
    summary: function () { return snapshot({}); },
  };

  // ==================================================================
  // راهنمای خودکار — بارِ اولِ هر بازی، یک‌بار
  // ==================================================================
  /**
   * هر بازی راهنمای خودش را دارد ولی با شناسه و کلاسِ متفاوت؛ وجهِ
   * مشترکشان این است که کنترلی با متنِ «راهنما» دارند. پس به‌جای نوشتنِ
   * متنِ تازه — که با محتوای بازی جور درنمی‌آمد — همان راهنمای واقعیِ
   * بازی صدا زده می‌شود. پیدا نشد، بی‌سروصدا رد می‌شود.
   */
  var GUIDE_KEY = 'luko_game_guide:' + slug;
  var GUIDE_SETTLE_MS = 900;
  var GUIDE_WORDS = /راهنما|آموزش|help/i;

  function guideSeen() {
    try { return localStorage.getItem(GUIDE_KEY) === '1'; } catch { return true; }
  }

  function markGuideSeen() {
    try { localStorage.setItem(GUIDE_KEY, '1'); } catch { /* حافظه پر/غیرفعال */ }
  }

  function findGuideButton() {
    var nodes = document.querySelectorAll('button, [role="button"], a, span, div');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var text = (el.textContent || '').trim();
      if (!text || text.length > 30 || !GUIDE_WORDS.test(text)) continue;
      // فقط چیزی که واقعاً روی صفحه دیده می‌شود و خودش دکمه است، نه ظرفِ آن
      if (el.querySelector('button, a, [role="button"]')) continue;
      var box = el.getBoundingClientRect();
      if (box.width > 8 && box.height > 8) return el;
    }
    return null;
  }

  function openGuideOnce() {
    if (guideSeen()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var btn = findGuideButton();
      if (btn) {
        clearInterval(timer);
        // دکمه که ظاهر شد یعنی منوی بازی رندر شده، ولی حالتِ داخلی‌اش
        // ممکن است هنوز آماده نباشد و راهنمای بعضی بازی‌ها به آن تکیه دارد.
        setTimeout(function () {
          markGuideSeen();
          try {
            btn.click();
            emit('guide_shown', {});
          } catch { /* بازی نباید به‌خاطرِ راهنما بشکند */ }
        }, GUIDE_SETTLE_MS);
      } else if (tries > 20) {
        clearInterval(timer);
      }
    }, 250);
  }

  // ==================================================================
  // چسبِ محیط
  // ==================================================================
  emit('game_loaded', { at: new Date().toISOString() });

  /**
   * بازیِ نسخهٔ ۱ هیچ‌وقت `startGame` نمی‌زند؛ ساعتش باید از بارگذاری
   * شروع شود وگرنه `durationMs` صفر می‌ماند و گزارشِ والدین خالی.
   *
   * ولی این را تا `load` عقب می‌اندازیم: اسکریپتِ خودِ بازی بعدِ این فایل
   * اجرا می‌شود و اگر `init()` صدا بزند، دیگر نباید `game_start`ِ خودکار
   * بفرستیم — وگرنه هر جلسه دو بار شمرده می‌شد.
   */
  // ساعت از همین حالا می‌رود؛ رویدادِ شروع اما منتظرِ اولین تعامل می‌ماند
  // (‏`ensureStarted`). بازیِ معرفی‌شده با `init()` ساعتش را از نو می‌گیرد.
  S.clock.start();

  if (document.readyState === 'complete') {
    setTimeout(openGuideOnce, 0);
  } else {
    window.addEventListener('load', openGuideOnce);
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, touch, { passive: true });
  });

  /**
   * ترکِ صفحه بدونِ اتمام. `visibilitychange` روی موبایل تنها چیزی است
   * که قابل اعتماد شلیک می‌شود، ولی برگشتن به تب هم شلیکش می‌کند — پس
   * فقط داده می‌فرستیم و جلسه را نمی‌بندیم.
   */
  function reportProgress() {
    if (S.finalized) return;
    post('luko-game-progress', { summary: snapshot({ abandoned: true }) });
  }

  window.addEventListener('pagehide', reportProgress);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (S.status === STATE.PLAYING) LUKO.pause('hidden');
      reportProgress();
    } else if (S.status === STATE.PAUSED) {
      LUKO.resume();
    }
  });

  window.LUKO = LUKO;
})();
