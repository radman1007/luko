import { createContext, useContext } from 'react';
import type { ChildSubscription } from '@/features/billing/types';
import type { Child, ParentNotification, ParentPreferences } from '../../types';

/** بخش‌های تنظیمات؛ هر کدام صفحه‌ی خودش را دارد (`?p=settings&s=…`) */
export type SettingsSection =
  | '' | 'child' | 'billing' | 'notifications' | 'support' | 'newticket' | 'ticket' | 'privacy' | 'about';

/**
 * هرچه بخش‌های تنظیمات از پنل لازم دارند. پنلِ واقعی و حالتِ مهمان هر کدام یکی می‌سازند؛
 * مهمان API ندارد (`guest`) و کارهایش فقط پیامِ «در حالتِ نمایشی» می‌دهد.
 */
export interface SettingsEnv {
  guest: boolean;
  parentName: string;
  parentPhone: string;
  phoneVerified: boolean;
  childList: Child[];
  activeChildId?: string;
  onChildChange: (id: string) => void;
  subscriptions?: ChildSubscription[];
  notifications?: { items: ParentNotification[]; unread: number };
  onReadAll: () => void;
  preferences?: ParentPreferences;
  onToggle: (key: keyof ParentPreferences, value: boolean) => void;
  onAddChild: () => void;
  onRemoveChild: (child: Child) => void;
  onLogout: () => void;
  onNotice: (message: string) => void;
  /** رفتن به یک بخش (و شناسه‌اش)؛ بخشِ خالی یعنی صفحه‌ی اصلیِ تنظیمات */
  open: (section: SettingsSection, id?: string, extra?: Record<string, string>) => void;
  /** پیوندِ داخلیِ پنل (مثلاً از اعلان) */
  follow: (link: string) => void;
}

export const SettingsContext = createContext<SettingsEnv | null>(null);

export function useSettingsEnv(): SettingsEnv {
  const env = useContext(SettingsContext);
  if (!env) throw new Error('SettingsContext provider missing');
  return env;
}

export const childName = (child?: Child) =>
  child ? `${child.firstName} ${child.lastName}`.trim() || 'بدونِ نام' : 'فرزندتان';
