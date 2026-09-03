/**
 * LUKO Game SDK — پلِ بینِ بازی و اپ.
 *
 * بازی فقط سه چیز صدا می‌زند:
 *   LUKO.answer({ topic, correct, ms, hintUsed })   هر پاسخ
 *   LUKO.hint(topic)                                هر راهنمایی
 *   LUKO.finish({ ... })                            پایانِ موفق
 *
 * بقیه‌اش خودکار است: شروعِ بازی، مدتِ فعال، بی‌حرکتی، و ارسالِ خلاصه هنگامِ
 * بستنِ صفحه. پیام‌ها با postMessage به اپ می‌روند و از آنجا به بک‌اند؛
 * گزارشِ پنل والدین از رویِ همین‌ها ساخته می‌شود.
 */
(function () {
  'use strict';

  var slug = (function () {
    var name = (location.pathname.split('/').pop() || '').replace(/\.html?$/, '');
    return decodeURIComponent(name);
  })();

  var sessionId = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var startedAt = Date.now();
  var lastActivity = Date.now();

  var stats = {
    asked: 0,
    correct: 0,
    hints: 0,
    idlePeriods: 0,
    totalAnswerMs: 0,
    answerTimes: [],
    topics: {},
  };

  var finished = false;
  var IDLE_MS = 30000;          // بی‌حرکتیِ بیش از ۳۰ ثانیه، «رهاکردن» حساب می‌شود

  function post(type, body) {
    try {
      var payload = { type: type, game: slug, sessionId: sessionId };
      for (var k in body) if (Object.prototype.hasOwnProperty.call(body, k)) payload[k] = body[k];
      window.parent.postMessage(payload, window.location.origin);
    } catch { /* بازی نباید به‌خاطرِ تله‌متری بشکند */ }
  }

  function touch() {
    var now = Date.now();
    if (now - lastActivity > IDLE_MS) {
      stats.idlePeriods++;
      post('luko-game-event', { event: { type: 'idle', ms: now - lastActivity } });
    }
    lastActivity = now;
  }

  function median(list) {
    if (!list.length) return 0;
    var s = list.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }

  function summary(extra) {
    var durationMs = Date.now() - startedAt;
    var topics = {};
    for (var key in stats.topics) {
      var t = stats.topics[key];
      topics[key] = {
        label: t.label || key,
        asked: t.asked,
        correct: t.correct,
        accuracy: t.asked ? Math.round((t.correct / t.asked) * 100) : 0,
        avgMs: t.asked ? Math.round(t.ms / t.asked) : 0,
        hints: t.hints,
      };
    }
    var out = {
      accuracy: stats.asked ? Math.round((stats.correct / stats.asked) * 100) : 0,
      asked: stats.asked,
      correct: stats.correct,
      errors: stats.asked - stats.correct,
      hints: stats.hints,
      idlePeriods: stats.idlePeriods,
      avgAnswerMs: stats.asked ? Math.round(stats.totalAnswerMs / stats.asked) : 0,
      medianAnswerMs: median(stats.answerTimes),
      durationMs: durationMs,
      topics: topics,
      device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  var LUKO = {
    /** هر پاسخِ بچه — قلبِ گزارشِ والدین */
    answer: function (data) {
      data = data || {};
      touch();
      var ms = typeof data.ms === 'number' ? data.ms : (Date.now() - lastActivity);
      var topic = data.topic || 'general';
      var correct = !!data.correct;

      stats.asked++;
      if (correct) stats.correct++;
      stats.totalAnswerMs += ms;
      stats.answerTimes.push(ms);

      if (!stats.topics[topic]) {
        stats.topics[topic] = { label: data.topicLabel || topic, asked: 0, correct: 0, ms: 0, hints: 0 };
      }
      var t = stats.topics[topic];
      t.asked++;
      t.ms += ms;
      if (correct) t.correct++;

      post('luko-game-event', {
        event: {
          type: 'answer',
          topic: topic,
          correct: correct,
          ms: ms,
          attempt: data.attempt || 1,
          hintUsed: !!data.hintUsed,
          tier: data.tier,
          given: data.given,
          expected: data.expected,
        },
      });
    },

    /** بچه راهنمایی خواست — نشانه‌ی «مفهوم را کامل نگرفته» */
    hint: function (topic) {
      touch();
      stats.hints++;
      var key = topic || 'general';
      if (stats.topics[key]) stats.topics[key].hints++;
      post('luko-game-event', { event: { type: 'hint', topic: key } });
    },

    /** شروعِ یک مرحله/دور */
    stage: function (name, index) {
      touch();
      post('luko-game-event', { event: { type: 'station_start', name: name, index: index } });
    },

    /** رویدادِ دلخواهِ خودِ بازی */
    event: function (type, data) {
      touch();
      var e = { type: type };
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) e[k] = data[k];
      post('luko-game-event', { event: e });
    },

    /** پایانِ موفق — یک‌بار بیشتر فرستاده نمی‌شود */
    finish: function (extra) {
      if (finished) return;
      finished = true;
      post('luko-game-complete', { summary: summary(extra) });
    },

    /** برای دیباگ در کنسول */
    summary: function () { return summary({}); },
  };

  // ------- خودکار -------
  post('luko-game-event', { event: { type: 'game_start', at: new Date().toISOString() } });

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, touch, { passive: true });
  });

  // بستنِ صفحه بدونِ اتمام: همین هم برای گزارش ارزش دارد
  window.addEventListener('pagehide', function () {
    if (!finished) post('luko-game-progress', { summary: summary({ abandoned: true }) });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && !finished) {
      post('luko-game-progress', { summary: summary({ abandoned: true }) });
    }
  });

  window.LUKO = LUKO;
})();
