import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ScrollToTop } from '@/components/ScrollToTop';
import { Analytics } from '@/components/Analytics';
import { AppRouter } from '@/router';
import { useSiteTimeDew } from '@/features/garden/useSiteTimeDew';
import { startOfflineSync } from '@/features/games/pendingCompletions';
import { startAccountSync } from '@/features/sync/accountSync';

export default function App() {
  useSiteTimeDew(); // شبنمِ «زمان حضور» در کل سایت جمع می‌شود
  // بازی‌ها و رویدادهایی که بی‌اینترنت ثبت شدند، با برگشتنِ اینترنت به سرور می‌روند
  useEffect(() => startOfflineSync(), []);
  // سکه، باغچه، مأموریت‌ها و ذخیره‌ی بازی‌ها بینِ سایت و اپِ اندرویدِ همین حساب
  useEffect(() => startAccountSync(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <Analytics />
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
