/*
 * کیفِ سکه‌ی مشترک — سکه‌ی داخلِ هر بازی همان سکه‌ی اصلیِ لوکوست.
 *
 * بازی‌های استودیو هرکدام کیفِ خودشان را داشتند (findMasterCoins،
 * state.coins، …) و هر بازی عددِ دیگری نشان می‌داد. حالا:
 *
 *   ۱. پیش از اجرای کدِ بازی، جایی که بازی سکه‌اش را ذخیره می‌کند با سکه‌ی
 *      اصلی (localStorage «luko_coins»، همان عددِ صفحه‌ی اصلی) پر می‌شود؛
 *   ۲. بعد از بالا آمدنِ بازی همان عدد داخلِ خودِ بازی گذاشته و نمایشش تازه
 *      می‌شود؛
 *   ۳. از آن به بعد هر تغییرِ سکه‌ی بازی — خرید از فروشگاه یا سکه‌ی جایزه —
 *      همان‌قدر روی سکه‌ی اصلی اعمال و به اپ خبر داده می‌شود.
 *
 * هر بازی یک «رابط» دارد (`window.LUKO_COINS`، کنارِ همین اسکریپت تزریق
 * می‌شود): get سکه‌ی فعلیِ بازی را می‌خواند، set عددی را در بازی می‌گذارد و
 * نمایشش را تازه می‌کند، seed می‌گوید بازی سکه‌اش را کجای localStorage
 * نگه می‌دارد. رابط‌ها در backend/apps/games/coin_adapters.py هستند.
 *
 * بیرون از اپ (بازکردنِ مستقیمِ فایل) کاری نمی‌کند.
 */
(function () {
  'use strict';

  var MAIN = 'luko_coins';
  /** بعد از بالا آمدن، بازی ممکن است هنوز ذخیره‌ی خودش را بخواند؛ آن مدت تغییر حساب نمی‌شود */
  var SETTLE_MS = 1500;
  var TICK_MS = 250;

  var cfg = window.LUKO_COINS;
  var embedded = false;
  try { embedded = window.parent !== window; } catch (e) { embedded = true; }
  if (!cfg || !embedded) return;

  function readMain() {
    try {
      var raw = localStorage.getItem(MAIN);
      if (raw === null) return null;
      var v = parseInt(raw, 10);
      return isFinite(v) && v >= 0 ? v : 0;
    } catch (e) {
      return null;
    }
  }

  function writeMain(v) {
    try { localStorage.setItem(MAIN, String(v)); } catch (e) { /* حافظه پر */ }
  }

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var node = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (node[parts[i]] === null || typeof node[parts[i]] !== 'object') return false;
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    return true;
  }

  /** جایی که بازی سکه‌اش را نگه می‌دارد = سکه‌ی اصلی (پیش از اجرای کدِ بازی) */
  function seed(value) {
    var list = cfg.seed || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      try {
        if (!s.path) {
          localStorage.setItem(s.key, String(value));
          continue;
        }
        var raw = localStorage.getItem(s.key);
        if (!raw) continue;
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && setPath(obj, s.path, value)) {
          localStorage.setItem(s.key, JSON.stringify(obj));
        }
      } catch (e) { /* ذخیره‌ی خراب — بازی خودش پیش‌فرض می‌گذارد */ }
    }
  }

  var main = readMain();
  // اپ هنوز کیف نساخته (نباید پیش بیاید) — بازی دست‌نخورده می‌ماند
  if (main === null) return;
  seed(main);

  var last = null;
  var settleUntil = 0;
  var started = false;

  function gameValue() {
    try {
      var v = Number(cfg.get());
      return isFinite(v) ? Math.round(v) : null;
    } catch (e) {
      return null; // بازی هنوز آماده نیست
    }
  }

  /** عدد را هم در ذخیره‌ی بازی می‌نویسد هم در حافظه و نمایشِ خودش — بعضی بازی‌ها وسطِ کار ذخیره را دوباره می‌خوانند */
  function push(v) {
    seed(v);
    try { cfg.set(v); } catch (e) { /* بازی هنوز آماده نیست؛ دورِ بعد */ }
    last = gameValue();
  }

  function tell(coins, delta) {
    try {
      window.parent.postMessage({ type: 'luko-coins', coins: coins, delta: delta }, '*');
    } catch (e) { /* بدونِ اپ */ }
  }

  function tick() {
    var cur = gameValue();
    var m = readMain();
    if (cur === null || m === null) return;

    // چند لحظه‌ی اول بازی ممکن است ذخیره‌ی قدیمیِ خودش را بخواند؛ هم‌ترازش می‌کنیم
    if (Date.now() < settleUntil) {
      if (cur !== m) push(m);
      else last = cur;
      return;
    }
    if (last === null) {
      last = cur;
      return;
    }
    if (cur === last) return;

    var delta = cur - last;
    var next = Math.max(0, m + delta);
    writeMain(next);
    last = cur;
    tell(next, delta);
    // اگر کیفِ اصلی جای دیگری عوض شده بود، بازی هم‌تراز می‌شود
    if (next !== cur) push(next);
  }

  function start() {
    if (started) return;
    started = true;
    var m = readMain();
    if (m === null) return;
    push(m);
    settleUntil = Date.now() + SETTLE_MS;
    setInterval(tick, TICK_MS);
  }

  if (document.readyState === 'complete') setTimeout(start, 300);
  else window.addEventListener('load', function () { setTimeout(start, 300); });

  /** برای آزمونِ خودکار: سکه‌ی بازی و سکه‌ی اصلی */
  window.LUKO_WALLET = {
    main: readMain,
    game: gameValue,
    ready: function () { return started && Date.now() >= settleUntil; },
  };
})();
