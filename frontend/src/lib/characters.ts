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
  health: {
    id: 'health',
    name: 'دکتر نیلا',
    role: 'پزشک مهربان شهر لوکو',
    image: '/characters/health.png',
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
    image: '/characters/welcome.png',
    theme: {
      primary: '#e56fa7',
      dark: '#c4568b',
      soft: '#fdeef5',
      accent: '#efb45c',
    },
  },
  club: {
    id: 'club',
    name: 'توپا',
    role: 'مربی باشگاه شهر لوکو',
    image: '/characters/club.png',
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
    image: '/characters/art.png',
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
    image: '/characters/sport.png',
    theme: {
      primary: '#e0454a',
      dark: '#b8353c',
      soft: '#fdecec',
      accent: '#6fbe44',
    },
  },
  tv: {
    id: 'tv',
    name: 'ویدا',
    role: 'مجری تلویزیون شهر لوکو',
    image: '/characters/tv.png',
    theme: {
      primary: '#9c5bc4',
      dark: '#7b44a0',
      soft: '#f5edfa',
      accent: '#f2994a',
    },
  },
  garden: {
    id: 'garden',
    name: 'سبزو',
    role: 'باغبان شهر لوکو',
    image: '/characters/garden.png',
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
    image: '/characters/maker.png',
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
    image: '/characters/explorer.png',
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
    image: '/characters/podcast.png',
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
    image: '/characters/science.png',
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
    image: '/characters/gamer.png',
    theme: {
      primary: '#7c5cbf',
      dark: '#241f31',
      soft: '#efeaf8',
      accent: '#4fd8c8',
    },
  },
  traffic: {
    id: 'traffic',
    name: 'سروان راه',
    role: 'پلیس راهنمای شهر لوکو',
    image: '/characters/traficman.png',
    theme: {
      primary: '#34456b',
      dark: '#24304d',
      soft: '#eaeef5',
      accent: '#d4a935',
    },
  },
  chef: {
    id: 'chef',
    name: 'سرآشپز زعفران',
    role: 'آشپزِ شهر لوکو',
    image: '/characters/chef.png',
    theme: {
      primary: '#d4384a',
      dark: '#a82a3a',
      soft: '#fdeef0',
      accent: '#f5b914',
    },
  },
  guard: {
    id: 'guard',
    name: 'آهنین',
    role: 'نگهبان رازهای شهر لوکو',
    image: '/characters/ironman_security.png',
    theme: {
      primary: '#5b6b82',
      dark: '#2b3242',
      soft: '#eef2f7',
      accent: '#22d3ee',
    },
  },
  // TODO: کاراکترهای صفحه اصلی و آکادمی کدنویسی بعد از رسیدن تصویرشان اضافه می‌شوند
} as const satisfies Record<string, Lukorian>;
