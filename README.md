# LUKO

پلتفرم آموزشی-سرگرمی کودکان دبستانی — بازسازی از صفر با ساختار تمیز و کامپوننت‌محور.
لیست کامل قابلیت‌ها: [docs/features.md](docs/features.md)

## ساختار
- `frontend/` — React 19 + Vite + TypeScript (strict)
- `backend/` — هنوز ساخته نشده

## اجرای فرانت
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## اسکریپت‌ها
```bash
npm run build      # tsc + vite build → dist/
npm run lint       # oxlint
npm run preview    # سرو کردن build
```

## متغیرهای محیطی (frontend/.env)
| متغیر | توضیح |
|---|---|
| `VITE_API_URL` | آدرس پایه‌ی API؛ پیش‌فرض `/api/v1` (پروکسی Vite در dev → `localhost:8000`) |

نمونه: [frontend/.env.example](frontend/.env.example)

## داستان برند و کاراکترها
شهر «لوکو» و قبیله‌ی LUKORIANS: هر بخش پلتفرم یک کاراکتر میزبان با تم رنگی خودش دارد
(رجیستری: `frontend/src/lib/characters.ts`، تصاویر: `frontend/public/characters/`).
کاراکترها با کامپوننت `CharacterGuide` مثل بازی‌ها ظاهر می‌شوند و با حباب کمیک راهنمایی می‌کنند.
**قانون:** emoji ممنوع — فقط SVG با استایل یکدست (Heroicons Outline + آیکون‌های اختصاصی `components/ui/icons`).

## معماری فرانت
- `src/pages/` — صفحه‌های route (فعلاً placeholder)
- `src/features/` — ماژول‌های فیچر (کامپوننت + hook + api کنار هم)؛ فعلاً `auth`
- `src/components/` — کامپوننت‌های اشتراکی UI (هر کامپوننت یک پوشه + CSS Module)
- `src/lib/` — کلاینت API، queryClient، ابزارها
- `src/types/` — تایپ‌های مشترک
- `src/styles/globals.css` — توکن‌های تم (CSS variables) — رنگ‌ها فقط از اینجا
