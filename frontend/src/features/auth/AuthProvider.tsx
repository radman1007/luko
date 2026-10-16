import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@/types/user';
import { audienceForPath, isTransientError, tokenStorage } from '@/lib/api';
import type { Audience } from '@/lib/api';
import { isPersonalQuery } from '@/lib/queryPersist';
import { leaveAccount } from '@/features/sync/accountSync';
import { AuthContext } from './context';
import { authApi } from './api';
import {
  GUEST_PARENT_USER,
  GUEST_USER,
  disableGuestMode,
  disableParentGuestMode,
  isGuestMode,
  isParentGuestMode,
} from './guest';

type Sessions = Record<Audience, User | null>;
type Flags = Record<Audience, boolean>;

/** بچه‌ی واردشده معلوم شد: هم‌رسانیِ داده‌ی دستگاه با حسابش همین حالا (`features/sync`) */
function announceKid() {
  window.dispatchEvent(new Event('luko:session-changed'));
}

/**
 * دو نشستِ مستقل روی یک مرورگر: بچه و والد.
 *
 * چون بچه‌ها معمولاً با شماره‌ی پدر/مادر ثبت‌نام می‌کنند و اپ روی همان گوشی
 * باز می‌ماند، این دو نباید هم را قطع کنند. هر فضا توکن، کاربر و خروجِ
 * خودش را دارد؛ `useAuth` همیشه نشستِ فضای مسیرِ فعلی را برمی‌گرداند.
 *
 * بازیابی آفلاین‌پذیر است: آخرین کاربرِ شناخته‌شده همان لحظه می‌نشیند و
 * `GET /auth/me` پشتِ صحنه تازه‌اش می‌کند. فقط ردِ صریحِ سرور نشست را
 * می‌بندد؛ قطعیِ اینترنت نه — قبلاً اپِ اندروید بی‌اینترنت بچه را بیرون می‌انداخت.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const audience = audienceForPath(pathname);
  const queryClient = useQueryClient();

  const [sessions, setSessions] = useState<Sessions>({ kid: null, parent: null });
  const [ready, setReady] = useState<Flags>({ kid: false, parent: false });
  /** توکن هست ولی نه کاربری از قبل داریم نه اینترنتی برای پرسیدنش */
  const [offline, setOffline] = useState<Flags>({ kid: false, parent: false });
  // از دوباره‌کاری در StrictMode و در هر بار جابه‌جاییِ مسیر جلوگیری می‌کند
  const started = useRef<Partial<Record<Audience, boolean>>>({});

  /** داده‌های شخصیِ بچه‌ی قبلی (پیشرفت، یادگاری‌ها) به بچه‌ی بعدی نرسد */
  const dropPersonalData = useCallback(() => {
    queryClient.removeQueries({ predicate: isPersonalQuery });
  }, [queryClient]);

  const restore = useCallback((who: Audience) => {
    const token = tokenStorage.get(who);
    if (!token) {
      if (who === 'parent' && isParentGuestMode()) {
        setSessions((s) => ({ ...s, parent: GUEST_PARENT_USER }));
      }
      if (who === 'kid' && isGuestMode()) {
        setSessions((s) => ({ ...s, kid: GUEST_USER }));
      }
      setReady((r) => ({ ...r, [who]: true }));
      return;
    }

    const known = tokenStorage.getUser(who);
    if (known) {
      setSessions((s) => ({ ...s, [who]: known }));
      setReady((r) => ({ ...r, [who]: true }));
    }

    authApi
      .getCurrentUser(who)
      .then((user) => {
        tokenStorage.setUser(user, who);
        setSessions((s) => ({ ...s, [who]: user }));
        setOffline((o) => ({ ...o, [who]: false }));
        if (who === 'kid') announceKid();
      })
      .catch((error) => {
        if (isTransientError(error)) {
          // اینترنت نیست: نشست سرِ جایش می‌ماند و با برگشتنِ اینترنت دوباره می‌پرسیم
          if (!known) setOffline((o) => ({ ...o, [who]: true }));
          return;
        }
        tokenStorage.clear(who);
        setSessions((s) => ({ ...s, [who]: null }));
      })
      .finally(() => setReady((r) => ({ ...r, [who]: true })));
  }, []);

  useEffect(() => {
    if (started.current[audience]) return;
    started.current[audience] = true;
    restore(audience);
  }, [audience, restore]);

  // اپ بی‌اینترنت و بی‌کاربرِ ذخیره‌شده باز شده بود: با برگشتنِ اینترنت خودش ادامه می‌دهد
  useEffect(() => {
    if (!offline[audience]) return undefined;
    const retry = () => restore(audience);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [offline, audience, restore]);

  const setUser = useCallback(
    (user: User | null) => {
      if (audience === 'kid') {
        const before = tokenStorage.getUser('kid')?.id ?? (isGuestMode() ? 'guest' : null);
        const after = user ? (user.isGuest ? 'guest' : user.id) : null;
        if (before !== after) dropPersonalData();
      }
      if (user && !user.isGuest && tokenStorage.get(audience)) {
        tokenStorage.setUser(user, audience);
        if (audience === 'kid') announceKid();
      }
      setSessions((s) => ({ ...s, [audience]: user }));
      if (user) setOffline((o) => ({ ...o, [audience]: false }));
    },
    [audience, dropPersonalData],
  );

  const logout = useCallback(() => {
    // آخرین تغییراتِ بچه با همان توکن فرستاده و داده‌اش از گوشی کنار گذاشته
    // می‌شود تا بچه‌ی بعدی (یا مهمان) سکه و باغچه‌ی او را نبیند
    authApi.logout(audience, audience === 'kid' ? leaveAccount() : undefined);
    if (audience === 'kid') {
      disableGuestMode();
      dropPersonalData();
    }
    if (audience === 'parent') {
      disableParentGuestMode();
    }
    setSessions((s) => ({ ...s, [audience]: null }));
    setOffline((o) => ({ ...o, [audience]: false }));
  }, [audience, dropPersonalData]);

  const retry = useCallback(() => restore(audience), [audience, restore]);

  const value = useMemo(
    () => ({
      user: sessions[audience],
      loading: !ready[audience],
      offline: offline[audience],
      retry,
      setUser,
      logout,
    }),
    [sessions, ready, offline, audience, retry, setUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
