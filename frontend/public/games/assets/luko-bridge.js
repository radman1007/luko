/*!
 * پلِ پایانِ بازی — برای بازی‌هایی که خودشان `LUKO.finish()` صدا نمی‌زنند.
 *
 * بازی‌های استودیو مستقل ساخته می‌شوند و قراردادِ اپ را نمی‌شناسند: هرکدام
 * صفحه‌ی بُردِ خودش را دارد. بدونِ خبرِ پایان، بچه هرچه بازی کند سکه نمی‌گیرد
 * و مرحله‌ی بعد باز نمی‌شود. این پل همان لحظه‌ی بُرد را از روی خودِ صفحه
 * تشخیص می‌دهد و یک‌بار به اپ خبر می‌دهد.
 *
 * ترتیبِ تشخیص:
 *   ۱. اگر خودِ بازی `LUKO.finish()` را صدا بزند، یا نقطه‌ی پایانش در
 *      `finish_points.py` ثبت شده باشد (`LUKO_EXPLICIT_FINISH`)، پل کنار می‌کشد.
 *   ۲. `window.LUKO_WIN` — نشانیِ قطعیِ صفحه‌ی پایان (شناسه‌اش خودش می‌گوید).
 *   ۳. `window.LUKO_WIN_MAYBE` — رویه‌ی عمومی؛ فقط اگر متنش هم بُرد باشد.
 *   ۴. حدسِ عمومی: عنصری که شناسه/کلاسش «برد/نتیجه/پایان» است و دیده می‌شود.
 *
 * هر دو فهرست را `manage.py import_games` هنگامِ آوردنِ بازی می‌سازد.
 *
 * محافظ‌ها: فقط یک‌بار خبر می‌دهد؛ تا چند ثانیه‌ی اولِ بازی چیزی نمی‌فرستد
 * (بعضی بازی‌ها مودالِ نتیجه را از قبل در DOM دارند و لحظه‌ی اول پنهانش
 * می‌کنند)؛ و عنصرهای راهنما/منو/تنظیمات را نادیده می‌گیرد.
 */
(function () {
  'use strict';

  var WIN = /(game-?complete|game-?finish|game-?over|final|result|victory|congrat|payan|win)/i;
  var LEVEL = /(level-?complete|level-?win|levelend|stage-?complete)/i;
  var SKIP = /(tutorial|guide|help|intro|onboard|menu|pause|setting|confirm|exit|shop|store|hint|toast|error)/i;
  /** بدونِ یکی از این‌ها، هر مودالی «بُرد» حساب نمی‌شود */
  var WORDS = /(تبریک|آفرین|بردی|برنده|عالی بود|پایانِ بازی|پایان بازی|تمام شد|امتیاز نهایی|کارت عالی|ایول|همه‌ی مرحله|همهٔ مرحله)/;

  /** پیش از این، بازی تازه شروع شده و مودالِ «نتیجه» نمی‌تواند واقعی باشد */
  var MIN_MS = 8000;
  var started = Date.now();
  var done = false;

  function sdk() {
    return window.LUKO && typeof window.LUKO.finish === 'function' ? window.LUKO : null;
  }

  function tell(reason) {
    if (done) return;
    done = true;
    try {
      var api = sdk();
      if (api) { api.finish({ source: 'bridge', reason: reason }); return; }
      window.parent.postMessage({
        type: 'luko-game-complete', game: location.pathname.split('/').pop(),
        summary: { source: 'bridge', reason: reason },
      }, '*');
    } catch (e) { /* بازی نباید به‌خاطرِ پل بشکند */ }
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect || !el.isConnected) return false;
    var rect = el.getBoundingClientRect();
    // مودالِ بُرد معمولاً بزرگ و روی صفحه است. `offsetParent` این‌جا به‌کار
    // نمی‌آید: عنصرِ `position: fixed` همیشه offsetParentِ null دارد و همه‌ی
    // مودال‌ها از قلم می‌افتادند.
    if (rect.width < 40 || rect.height < 40) return false;
    if (rect.bottom < 0 || rect.top > (innerHeight || 0) + rect.height) return false;
    var style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity || 1) <= 0.05) return false;
    // والدِ پنهان هم یعنی پنهان
    for (var p = el.parentElement; p; p = p.parentElement) {
      var ps = getComputedStyle(p);
      if (ps.display === 'none' || ps.visibility === 'hidden' || Number(ps.opacity || 1) <= 0.05) {
        return false;
      }
    }
    return true;
  }

  function label(el) {
    return (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '');
  }

  function isWin(el) {
    var name = label(el);
    if (SKIP.test(name)) return false;
    if (!WIN.test(name) && !LEVEL.test(name)) return false;
    // متنِ برد لازم است مگر خودِ شناسه صریح باشد (gameComplete، winModal، …)
    var text = (el.innerText || '').slice(0, 400);
    return WORDS.test(text) || WIN.test(name);
  }

  function match(list, needText) {
    if (!list || !list.length) return null;
    for (var i = 0; i < list.length; i += 1) {
      try {
        var el = document.querySelector(list[i]);
        if (!el || !visible(el)) continue;
        // رویه‌ی عمومی (مثلِ «action-overlay» که هم برای بُرد است هم برای
        // باخت) فقط وقتی پایان است که متنش هم بگوید.
        if (needText && !WORDS.test((el.innerText || '').slice(0, 400))) continue;
        return list[i];
      } catch (e) { /* نشانیِ نامعتبر */ }
    }
    return null;
  }

  function hinted() {
    return match(window.LUKO_WIN, false) || match(window.LUKO_WIN_MAYBE, true);
  }

  function scan() {
    if (done || Date.now() - started < MIN_MS) return;
    // بازی نقطه‌ی پایانِ خودش را دارد (apps/games/finish_points.py)؛ حدس
    // این‌جا فقط ضرر داشت: باخت و خریدِ پوسته را هم «بُرد» می‌گرفت
    if (window.LUKO_EXPLICIT_FINISH) return;
    var hit = hinted();
    if (hit) { tell('hint ' + hit); return; }
    var nodes = document.querySelectorAll('[id], [class]');
    for (var i = 0; i < nodes.length; i += 1) {
      if (isWin(nodes[i]) && visible(nodes[i])) { tell(label(nodes[i]).trim()); return; }
    }
  }

  function watch() {
    try {
      new MutationObserver(scan).observe(document.documentElement, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
      });
    } catch (e) { /* مرورگرِ خیلی قدیمی */ }
    setInterval(scan, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();
