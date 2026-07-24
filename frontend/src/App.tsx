import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ScrollToTop } from '@/components/ScrollToTop';
import { AppRouter } from '@/router';
import { useSiteTimeDew } from '@/features/garden/useSiteTimeDew';

export default function App() {
  useSiteTimeDew(); // شبنمِ «زمان حضور» در کل سایت جمع می‌شود

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
