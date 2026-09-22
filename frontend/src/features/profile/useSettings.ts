import { useCallback, useState } from 'react';
import { useStorageChange } from '@/lib/useStorageChange';

const SETTINGS_KEY = 'luko_settings';
const GUIDE_PREFIX = 'luko_guide_';

export interface KidSettings {
  /** صدای افکت‌ها */
  sound: boolean;
  /** موسیقی پس‌زمینه */
  music: boolean;
  /** یادآور ثبت حال هر ۴ ساعت */
  moodReminder: boolean;
}

const DEFAULTS: KidSettings = { sound: true, music: true, moodReminder: true };

function load(): KidSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<KidSettings>) };
  } catch {
    /* داده‌ی خراب → پیش‌فرض */
  }
  return DEFAULTS;
}

const isSettingsKey = (key: string) => key === SETTINGS_KEY;

/** تنظیمات بچه — رمز و مشخصات فقط از پنل والدین قابل تغییر است */
export function useSettings() {
  const [settings, setSettings] = useState<KidSettings>(load);
  // تنظیمی که روی دستگاهِ دیگرِ همین حساب عوض شده
  useStorageChange(isSettingsKey, useCallback(() => setSettings(load()), []));

  const toggle = useCallback((key: keyof KidSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** راهنمای کاراکترها در همه‌ی صفحه‌ها دوباره نمایش داده می‌شود */
  const resetGuides = useCallback(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(GUIDE_PREFIX)) localStorage.removeItem(key);
    }
  }, []);

  return { settings, toggle, resetGuides };
}
