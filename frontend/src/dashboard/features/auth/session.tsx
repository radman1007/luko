import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { SESSION_LOST, getData, send } from '../../lib/api';
import type { Capability, Me } from '../../types';
import { SessionContext } from './useSession';
import { useToast } from '../../components/Toast/toastContext';


/**
 * بیرون رفتن: «من» تهی، بقیه‌ی داده‌ها پاک. clear() نه — آن ناظرِ «من» را از کش جدا
 * می‌کند و صفحه دیگر خبردار نمی‌شود (خروج بی‌اثر می‌ماند).
 */
function forget(queryClient: QueryClient) {
  queryClient.setQueryData(['me'], null);
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

async function fetchMe(): Promise<Me | null> {
  try {
    return await getData<Me>('me');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) return null;
    throw error;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 5 * 60_000, retry: false });
  const me = query.data ?? null;
  // خروجِ خودِ کاربر: درخواست‌هایی که هم‌زمان در راه بودند بعد از آن ۴۰۱ می‌گیرند؛ پیامِ «نشست بسته شد» نباید بیاید
  const leaving = useRef(false);

  useEffect(() => {
    const lost = (event: Event) => {
      const quiet = leaving.current || !queryClient.getQueryData(['me']);
      forget(queryClient);
      if (!quiet) toast((event as CustomEvent<string>).detail || 'نشست بسته شد؛ دوباره وارد شوید.', 'error');
    };
    window.addEventListener(SESSION_LOST, lost);
    return () => window.removeEventListener(SESSION_LOST, lost);
  }, [queryClient, toast]);

  const can = useCallback(
    (cap: Capability | 'superuser') => Boolean(me && (cap === 'superuser' ? me.isSuperuser : me.capabilities.includes(cap))),
    [me],
  );
  const signedIn = useCallback((next: Me) => {
    leaving.current = false;
    queryClient.setQueryData(['me'], next);
  }, [queryClient]);
  const signOut = useCallback(async () => {
    leaving.current = true;
    try {
      await send('post', 'auth/logout');
    } finally {
      forget(queryClient);
    }
  }, [queryClient]);

  const value = useMemo(() => ({ me, loading: query.isLoading, can, signedIn, signOut }), [me, query.isLoading, can, signedIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
