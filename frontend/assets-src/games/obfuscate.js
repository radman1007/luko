/**
 * مبهم‌سازیِ اسکریپت‌های داخلِ هر بازی.
 * هدف: بالا بردنِ هزینه‌ی کپی‌برداری — نه ادعای امنیتِ مطلق (کدِ سمتِ کلاینت
 * همیشه قابلِ خواندن است؛ این فقط کار را سخت و بی‌صرفه می‌کند).
 */
const fs = require('fs');
const obfuscator = require('javascript-obfuscator');

const OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,   // بالاتر از این، بازی‌های سنگین کند می‌شوند
  deadCodeInjection: false,              // حجم را زیاد می‌کند؛ برای موبایل نمی‌ارزد
  stringArray: true,
  stringArrayThreshold: 0.8,
  stringArrayEncoding: ['base64'],
  stringArrayWrappersType: 'function',
  identifierNamesGenerator: 'mangled',
  numbersToExpressions: false,
  simplify: true,
  splitStrings: false,
  transformObjectKeys: false,            // با کدهایی که با نامِ کلید کار می‌کنند نمی‌سازد
  unicodeEscapeSequence: false,          // متنِ فارسی را نباید خراب کند
  selfDefending: false,                  // با فرمت‌کردنِ خودکارِ مرورگر تداخل دارد
  debugProtection: false,
  disableConsoleOutput: false,
};

const files = process.argv.slice(2);
let okCount = 0, failCount = 0, before = 0, after = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  before += Buffer.byteLength(html);
  let failed = false;

  const out = html.replace(
    /(<script(?![^>]*\ssrc=)[^>]*>)([\s\S]*?)(<\/script>)/g,
    (whole, open, code, close) => {
      if (!code.trim()) return whole;
      // نوعِ ماژول/JSON را دست نزن
      if (/type\s*=\s*["'](?!text\/javascript)/i.test(open)) return whole;
      try {
        const result = obfuscator.obfuscate(code, OPTIONS).getObfuscatedCode();
        // تستِ سلامت: خروجی باید پارس شود
        new Function(result);
        return open + result + close;
      } catch (e) {
        failed = true;
        console.log('  ⚠️ رد شد:', file, '→', e.message.slice(0, 60));
        return whole;
      }
    },
  );

  fs.writeFileSync(file, out);
  after += Buffer.byteLength(out);
  if (failed) failCount++;
  else okCount++;
  process.stdout.write(failed ? '!' : '.');
}

console.log(`\n✓ ${okCount} بازی مبهم شد` + (failCount ? `، ${failCount} بازی بخشی رد شد` : ''));
console.log(`حجم: ${(before / 1e6).toFixed(2)}MB → ${(after / 1e6).toFixed(2)}MB`);
