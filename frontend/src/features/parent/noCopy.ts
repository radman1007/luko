import type { MouseEvent } from 'react';

/**
 * پنلِ والدین (ورود و خودِ پنل): انتخابِ متن با CSS بسته است (`user-select: none`) و راست‌کلیک با همین.
 * روی جای نوشتن باز می‌ماند تا چسباندنِ شماره، کد و پرسش کار کند.
 */
export function blockContextMenu(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, [contenteditable="true"]')) return;
  event.preventDefault();
}
