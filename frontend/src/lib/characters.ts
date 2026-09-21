/**
 * قبیله‌ی LUKORIANS — ساکنان شهر لوکو.
 * هر بخش از پلتفرم یک کاراکتر میزبان دارد که با تم رنگی خودش
 * آن بخش را روایت و راهنمایی می‌کند. تصویرها در public/characters/.
 */
export interface Lukorian {
  id: string;
  /** نام کاراکتر */
  name: string;
  /** نقشش در شهر لوکو */
  role: string;
  image: string;
  theme: {
    primary: string;
    dark: string;
    soft: string;
    accent: string;
  };
}

export const LUKORIANS = {
  /** لوکی — کاراکتر اصلیِ شهر و میزبانِ صفحه‌ی خانه (کلید `luko` می‌ماند چون شناسه است) */
  luko: {
    id: 'luko',
    name: 'لوکی',
    role: 'رفیقِ همیشگیِ شهر لوکو',
    image: '/characters/luko.webp',
    theme: {
      primary: '#f59322',
      dark: '#d9750a',
      soft: '#fff3e0',
      accent: '#2f5f9f',
    },
  },
  health: {
    id: 'health',
    name: 'دکتر نیلا',
    role: 'پزشک مهربان شهر لوکو',
    image: '/characters/health.webp',
    theme: {
      primary: '#4696e5',
      dark: '#2f6fb5',
      soft: '#e9f3fc',
      accent: '#8f6bc9',
    },
  },
  welcome: {
    id: 'welcome',
    name: 'پری',
    role: 'راهنمای شهر لوکو',
    image: '/characters/welcome.webp',
    theme: {
      primary: '#e56fa7',
      dark: '#c4568b',
      soft: '#fdeef5',
      accent: '#efb45c',
    },
  },
  /** پویا — داداشِ پری؛ پری نقشه دارد و پویا قطب‌نما. با هم دمِ دروازه‌ی شهرند (ورود). */
  navigator: {
    id: 'navigator',
    name: 'پویا',
    role: 'راه‌یابِ شهر لوکو',
    image: '/characters/navigator.webp',
    theme: {
      primary: '#1a8f7f',
      dark: '#0f6258',
      soft: '#e2f5f0',
      accent: '#4a9fe0',
    },
  },
  club: {
    id: 'club',
    name: 'توپا',
    role: 'مربی باشگاه شهر لوکو',
    image: '/characters/club.webp',
    theme: {
      primary: '#2e9e5b',
      dark: '#1f7a44',
      soft: '#e7f5ec',
      accent: '#f2b830',
    },
  },
  art: {
    id: 'art',
    name: 'رنگو',
    role: 'نقاش شهر لوکو',
    image: '/characters/art.webp',
    theme: {
      primary: '#4696e5',
      dark: '#2f6fb5',
      soft: '#e9f3fc',
      accent: '#f2994a',
    },
  },
  sport: {
    id: 'sport',
    name: 'چابک',
    role: 'قهرمان ورزش شهر لوکو',
    image: '/characters/sport.webp',
    theme: {
      primary: '#e0454a',
      dark: '#b8353c',
      soft: '#fdecec',
      accent: '#6fbe44',
    },
  },
  garden: {
    id: 'garden',
    name: 'سبزو',
    role: 'باغبان شهر لوکو',
    image: '/characters/garden.webp',
    theme: {
      primary: '#6f9455',
      dark: '#55763f',
      soft: '#eef3e6',
      accent: '#c1663b',
    },
  },
  maker: {
    id: 'maker',
    name: 'مکانو',
    role: 'سازنده و مکانیک شهر لوکو',
    image: '/characters/maker.webp',
    theme: {
      primary: '#e0813c',
      dark: '#b45f27',
      soft: '#fbeee1',
      accent: '#7c8494',
    },
  },
  explorer: {
    id: 'explorer',
    name: 'کاشف',
    role: 'جوینده‌ی گنج‌های شهر لوکو',
    image: '/characters/explorer.webp',
    theme: {
      primary: '#566380',
      dark: '#3e4a63',
      soft: '#edf0f5',
      accent: '#c9992e',
    },
  },
  podcast: {
    id: 'podcast',
    name: 'آوا',
    role: 'پادکست‌ساز شهر لوکو',
    image: '/characters/podcast.webp',
    theme: {
      primary: '#e27698',
      dark: '#c25577',
      soft: '#fbebf1',
      accent: '#8b5fbf',
    },
  },
  science: {
    id: 'science',
    name: 'دانا',
    role: 'دانشمند شهر لوکو',
    // TODO: تصویرِ دانا هنوز نرسیده — این فایل وجود ندارد. پیش از استفاده از این
    // کاراکتر در هر صفحه‌ای، باید شیتش گرفته و مثل بقیه به webp تبدیل شود.
    image: '/characters/science.webp',
    theme: {
      primary: '#57b39a',
      dark: '#3d8a75',
      soft: '#e8f5f0',
      accent: '#e5c76b',
    },
  },
  gamer: {
    id: 'gamer',
    name: 'پیکسل',
    role: 'باحالِ شهر لوکو',
    // TODO: تصویر هنوز نرسیده — بعد از ذخیره در Downloads پردازش و جایگزین می‌شود
    image: '/characters/gamer.webp',
    theme: {
      primary: '#7c5cbf',
      dark: '#241f31',
      soft: '#efeaf8',
      accent: '#4fd8c8',
    },
  },
  guard: {
    id: 'guard',
    name: 'آهنین',
    role: 'نگهبان رازهای شهر لوکو',
    image: '/characters/ironman_security.webp',
    theme: {
      primary: '#5b6b82',
      dark: '#2b3242',
      soft: '#eef2f7',
      accent: '#22d3ee',
    },
  },
  courier: {
    id: 'courier',
    name: 'چاپار',
    role: 'پیکِ دوچرخه‌سوار شهر لوکو',
    image: '/characters/bikerider.webp',
    theme: {
      primary: '#e07d3a',
      dark: '#b35d22',
      soft: '#fbeae0',
      accent: '#f4c04a',
    },
  },
  ranger: {
    id: 'ranger',
    name: 'بلوط',
    role: 'طبیعت‌بانِ شهر لوکو',
    image: '/characters/parkingattendant.webp',
    theme: {
      primary: '#7a8b46',
      dark: '#5c6a33',
      soft: '#eef1e2',
      accent: '#c98a3a',
    },
  },
  // TODO: کاراکترهای صفحه اصلی و آکادمی کدنویسی بعد از رسیدن تصویرشان اضافه می‌شوند
} as const satisfies Record<string, Lukorian>;
