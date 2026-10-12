import { useEffect } from 'react';
import { coverGoftino } from './goftino';

/** تا وقتی `open` است حبابِ گفتینو پنهان می‌ماند (شیت‌ها و پنجره‌های پنلِ والدین) */
export function useCoverGoftino(open: boolean): void {
  useEffect(() => (open ? coverGoftino() : undefined), [open]);
}
