// مدتِ پادکست را از خودِ فایلی که انتخاب شد می‌خواند و «مدت (دقیقه)» را پر می‌کند.
// مرورگر فایل را محلی باز می‌کند؛ چیزی جایی فرستاده نمی‌شود.
(function () {
  'use strict';
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    var input = document.getElementById('id_audio_file');
    var minutes = document.getElementById('id_duration_minutes');
    if (!input || !minutes) return;
    var note = document.createElement('div');
    note.className = 'help';
    input.parentNode.appendChild(note);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      note.textContent = '';
      if (!file) return;
      var url = URL.createObjectURL(file);
      var audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = function () {
        var seconds = audio.duration;
        URL.revokeObjectURL(url);
        if (!isFinite(seconds) || seconds <= 0) return;
        minutes.value = Math.max(1, Math.round(seconds / 60));
        var m = Math.floor(seconds / 60);
        var s = Math.round(seconds % 60);
        note.textContent = 'مدتِ فایل: ' + m + ' دقیقه و ' + s + ' ثانیه — «مدت» خودش پر شد.';
      };
      audio.onerror = function () {
        URL.revokeObjectURL(url);
        note.textContent = 'مرورگر این فایل را پخش نمی‌کند؛ بهتر است MP3 باشد.';
      };
      audio.src = url;
    });
  });
})();
