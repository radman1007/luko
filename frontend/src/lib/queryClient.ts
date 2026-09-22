import { QueryClient } from '@tanstack/react-query';
import { isGuestMode } from '@/features/auth/guest';
import { tokenStorage } from './api';
import { persistQueries, restoreQueries } from './queryPersist';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * صاحبِ داده‌های شخصیِ ذخیره‌شده: بچه‌ی واردشده، یا «مهمان».
 * داده‌های یک بچه نباید بعد از ورودِ بچه‌ی دیگری روی همین گوشی دیده شوند.
 */
export function cacheOwner(): string | null {
  if (tokenStorage.get('kid')) return tokenStorage.getUser('kid')?.id ?? null;
  return isGuestMode() ? 'guest' : null;
}

if (typeof window !== 'undefined') {
  restoreQueries(queryClient, cacheOwner());
  persistQueries(queryClient, cacheOwner);
}
