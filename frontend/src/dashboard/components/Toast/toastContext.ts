import { createContext, useContext } from 'react';

export type ToastTone = 'ok' | 'error';

export const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}
