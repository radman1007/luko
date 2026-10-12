import { useSyncExternalStore } from 'react';
import { isGoftinoReady, subscribeGoftino } from './goftino';

/** ویجتِ گفتینو بالا آمده و می‌شود بازش کرد */
export function useGoftinoReady(): boolean {
  return useSyncExternalStore(subscribeGoftino, isGoftinoReady, () => false);
}
