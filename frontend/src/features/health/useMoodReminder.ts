import { useCallback, useState } from 'react';
import { isGuestMode } from '@/features/auth/guest';
import { completeMission } from '@/features/club/store';
import { apiClient } from '@/lib/api';
import { useStorageChange } from '@/lib/useStorageChange';
import type { Mood } from './types';

const LAST_MOOD_TIME_KEY = 'luko_last_mood_time';
const LAST_MOOD_KEY = 'luko_last_mood';
const REMIND_INTERVAL_MS = 4 * 60 * 60 * 1000; // هر ۴ ساعت

/** اگر بچه یادآور را در تنظیمات خاموش کرده باشد، مودال خودکار باز نمی‌شود */
function reminderEnabled(): boolean {
  try {
    const raw = localStorage.getItem('luko_settings');
    if (raw) return (JSON.parse(raw) as { moodReminder?: boolean }).moodReminder !== false;
  } catch {
    /* داده‌ی خراب → پیش‌فرض روشن */
  }
  return true;
}

function isDue(): boolean {
  if (!reminderEnabled()) return false;
  const last = Number(localStorage.getItem(LAST_MOOD_TIME_KEY));
  return !last || Date.now() - last >= REMIND_INTERVAL_MS;
}

function storedMood(): Mood | null {
  return localStorage.getItem(LAST_MOOD_KEY) as Mood | null;
}

const isMoodKey = (key: string) => key === LAST_MOOD_KEY || key === LAST_MOOD_TIME_KEY;

/** ثبت حال: یادآور خودکار هر ۴ ساعت + امکان باز کردن دستی مودال */
export function useMoodReminder() {
  const [show, setShow] = useState(isDue);
  const [lastMood, setLastMood] = useState<Mood | null>(storedMood);
  // حالی که همین حالا روی دستگاهِ دیگرِ همین حساب ثبت شد: یادآور دوباره نمی‌پرسد
  useStorageChange(isMoodKey, useCallback(() => {
    setLastMood(storedMood());
    setShow((open) => open && isDue());
  }, []));

  const record = useCallback((mood: Mood) => {
    const at = Date.now();
    localStorage.setItem(LAST_MOOD_TIME_KEY, String(at));
    localStorage.setItem(LAST_MOOD_KEY, mood);
    // پنلِ والد از ثبتِ حالِ سرور می‌خواند. بی‌اینترنت مهم نیست: همین دو کلید هم‌رسان می‌شوند و سرور از همان
    // زمانِ `at` حال را ثبت می‌کند (یک حال دوبار شمرده نمی‌شود — apps.health.services.record_device_mood)
    if (!isGuestMode()) void apiClient.post('/moods/checkin', { mood, at }).catch(() => undefined);
    setLastMood(mood);
    setShow(false);
    // مأموریتِ «حالت رو بگو» همین‌جا خودکار ثبت می‌شود
    completeMission('mood');
  }, []);

  const open = useCallback(() => setShow(true), []);
  const dismiss = useCallback(() => setShow(false), []);

  return { show, lastMood, record, open, dismiss };
}
