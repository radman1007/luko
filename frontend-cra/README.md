# لوکو — فرانت‌اند (نسخهٔ Create React App)

این همان فرانت‌اندِ پروژهٔ لوکوست که به‌جای Vite با **react-scripts** اجرا می‌شود.
کدِ داخلِ `src/` عیناً همان کدِ نسخهٔ اصلی است؛ فقط چیزهایی که به ابزارِ بیلد
وابسته‌اند عوض شده‌اند (فهرستشان پایین آمده).

## راه‌اندازی

```bash
npm install
npm start
```
روی `http://localhost:3000` بالا می‌آید.

```bash
npm run build      # خروجیِ production در build/
```

## اتصال به بک‌اند

فرانت انتظار دارد API روی `/api/v1` باشد. دو راه:

۱. **پروکسیِ توسعه (پیش‌فرض):** فیلدِ `"proxy": "http://localhost:8000"` در
   `package.json` هر درخواستِ `/api` را به بک‌اندِ لوکال می‌فرستد. کافی است
   بک‌اند Django روی پورت ۸۰۰۰ در حال اجرا باشد:
   ```bash
   cd ../backend && source .venv/bin/activate && python manage.py runserver 8000
   ```

۲. **آدرسِ دلخواه:** در فایل `.env` مقدارِ زیر را بگذارید و سرور را دوباره اجرا کنید:
   ```
   REACT_APP_API_URL=https://api.example.com/api/v1
   ```

> اگر بک‌اند بالا نباشد، صفحه‌ها بالا می‌آیند ولی داده‌ای نمی‌گیرند.
> برای دیدنِ **پنل والدین بدونِ بک‌اند**، «ورود به عنوان مهمان» را بزنید و بروید به
> `/parent-panel` — دادهٔ نمونه از `src/features/parent/demoMode.ts` می‌آید.

## ساختار

```
public/            index.html + تصویرها + بازی‌های HTML5
src/
  components/      اجزای مشترک (لایوت، آیکون‌ها، کاراکترها)
  features/        هر قابلیت با کامپوننت/داده/هوکِ خودش
    parent/        پنل والدین (پنج تب)
    games/         تله‌متریِ بازی‌ها
    ...
  pages/           صفحه‌ها (هرکدام lazy در router)
  lib/             کلاینت axios، queryClient، کاراکترها
  styles/          توکن‌های سراسری و فونت‌ها
```

## تفاوت‌ها با نسخهٔ Vite

| مورد | نسخهٔ Vite | این نسخه |
|---|---|---|
| نقطهٔ ورود | `index.html` در ریشه + `src/main.tsx` | `public/index.html` + `src/index.tsx` |
| مسیرِ importها | `@/features/...` | `features/...` (با `baseUrl: "src"`) |
| متغیرِ محیطی | `import.meta.env.VITE_API_URL` | `process.env.REACT_APP_API_URL` |
| پروکسیِ dev | `server.proxy` در `vite.config.ts` | `"proxy"` در `package.json` |
| پورتِ dev | ۵۱۷۳ | ۳۰۰۰ |

بقیهٔ کد — کامپوننت‌ها، CSS Modules، مسیرها، هوک‌ها — دست‌نخورده است.

## نکته‌های فنی

- **TypeScript 5** لازم است (نه ۴ که پیش‌فرضِ CRA است)، چون تایپ‌های React 19
  با TS 4 سازگار نیستند. در `devDependencies` تنظیم شده است.
- `react-scripts@5` هنوز TypeScript 4 را در `peerDependencies` اعلام می‌کند. برای
  همین فایلِ `.npmrc` با `legacy-peer-deps=true` کنارِ پروژه هست تا `npm install`
  بدونِ خطا اجرا شود. **این فایل را پاک نکنید**، وگرنه نصب با `ERESOLVE` می‌ایستد.
- CSS Modules با پسوندِ `.module.css` کار می‌کند (همان قراردادِ قبلی).
