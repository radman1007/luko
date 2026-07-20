import type { Mood } from './types';

export const MOODS: { value: Mood; label: string }[] = [
  { value: 'happy', label: 'خوشحال' },
  { value: 'calm', label: 'آروم' },
  { value: 'tired', label: 'خسته' },
  { value: 'sad', label: 'ناراحت' },
  { value: 'angry', label: 'عصبانی' },
];

export const MOOD_LABEL: Record<Mood, string> = Object.fromEntries(
  MOODS.map((m) => [m.value, m.label]),
) as Record<Mood, string>;
