import type { MoodVariant } from '@/components/ui/icons';

/**
 * رنگ و نامِ هر حال در صفحه‌ی سلامت. رنگ هرگز تنها نشانه نیست: کنارِ هر رنگ صورتکِ همان حال
 * و نامش هست. شاد و آرام «خوب»، خسته «کم‌انرژی»، ناراحت و عصبانی «سخت» (apps/parent/wellbeing.py).
 */
export const MOOD_LOOK: Record<MoodVariant, { label: string; color: string; soft: string }> = {
  happy: { label: 'شاد', color: '#e9a800', soft: '#fff4cf' },
  calm: { label: 'آرام', color: '#2a9d8f', soft: '#def3ef' },
  tired: { label: 'خسته', color: '#8a94a6', soft: '#eef0f3' },
  sad: { label: 'ناراحت', color: '#4f74d0', soft: '#e7edfb' },
  angry: { label: 'عصبانی', color: '#d64545', soft: '#fde6e6' },
};

export const MOOD_ORDER: MoodVariant[] = ['happy', 'calm', 'tired', 'sad', 'angry'];

export const fa = (value: number) => value.toLocaleString('fa-IR');
