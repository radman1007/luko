import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell/Shell';
import { NAV } from './components/Shell/nav';
import { Loading } from './components/States/States';
import { ToastProvider } from './components/Toast/Toast';
import { LoginPage } from './features/auth/LoginPage';
import { SessionProvider } from './features/auth/session';
import { useSession } from './features/auth/useSession';
import { BASE } from './lib/base';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditPage } from './pages/AuditPage';
import { BlogEditorPage } from './pages/blog/BlogEditorPage';
import { BlogPage } from './pages/blog/BlogPage';
import { NoticesPage } from './pages/notices/NoticesPage';
import { OverviewPage } from './pages/OverviewPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PodcastsPage } from './pages/podcasts/PodcastsPage';
import { StaffPage } from './pages/staff/StaffPage';
import { TicketDetailPage } from './pages/tickets/TicketDetailPage';
import { TicketsPage } from './pages/tickets/TicketsPage';
import { UserDetailPage } from './pages/users/UserDetailPage';
import { UsersPage } from './pages/users/UsersPage';
import type { Capability } from './types';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 30_000 } },
});

function Guard({ need, children }: { need: Capability | 'superuser'; children: ReactNode }) {
  const { can } = useSession();
  return can(need) ? children : <Navigate to="/" replace />;
}

/** صفحه‌ی اول: نمای کلی، یا اولین بخشی که این کارمند دارد */
function Home() {
  const { can } = useSession();
  if (can('stats')) return <OverviewPage />;
  const first = NAV.find((item) => can(item.need));
  return first ? <Navigate to={first.to} replace /> : <p>هیچ بخشی برای این حساب باز نیست.</p>;
}

function Routed() {
  const { me, loading } = useSession();
  if (loading) return <Loading label="در حالِ باز کردنِ داشبورد…" />;
  if (!me) return <LoginPage />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/analytics" element={<Guard need="stats"><AnalyticsPage /></Guard>} />
        <Route path="/users" element={<Guard need="users_view"><UsersPage /></Guard>} />
        <Route path="/users/:id" element={<Guard need="users_view"><UserDetailPage /></Guard>} />
        <Route path="/payments" element={<Guard need="payments"><PaymentsPage /></Guard>} />
        <Route path="/tickets" element={<Guard need="tickets"><TicketsPage /></Guard>} />
        <Route path="/tickets/:id" element={<Guard need="tickets"><TicketDetailPage /></Guard>} />
        <Route path="/podcasts" element={<Guard need="podcasts"><PodcastsPage /></Guard>} />
        <Route path="/blog" element={<Guard need="blog"><BlogPage /></Guard>} />
        <Route path="/blog/:id" element={<Guard need="blog"><BlogEditorPage /></Guard>} />
        <Route path="/notices" element={<Guard need="notify"><NoticesPage /></Guard>} />
        <Route path="/staff" element={<Guard need="superuser"><StaffPage /></Guard>} />
        <Route path="/audit" element={<Guard need="audit"><AuditPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <BrowserRouter basename={BASE}>
            <Routed />
          </BrowserRouter>
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
