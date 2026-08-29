import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { PageLoader } from '@/components/PageLoader/PageLoader';

const Login = lazy(() => import('@/pages/Login'));
const ParentLogin = lazy(() => import('@/pages/ParentLogin'));
const Register = lazy(() => import('@/pages/Register'));

const Home = lazy(() => import('@/pages/Home'));
const GameHall = lazy(() => import('@/pages/GameHall'));
const BookGame = lazy(() => import('@/pages/BookGame'));
const LukoClub = lazy(() => import('@/pages/LukoClub'));
const LukoPodcast = lazy(() => import('@/pages/LukoPodcast'));
const LukoHealth = lazy(() => import('@/pages/LukoHealth'));
const Garden = lazy(() => import('@/pages/Garden'));
const Profile = lazy(() => import('@/pages/Profile'));

const ParentPanel = lazy(() => import('@/pages/ParentPanel'));
const TeacherPanel = lazy(() => import('@/pages/TeacherPanel'));
const SchoolPanel = lazy(() => import('@/pages/SchoolPanel'));
const AdminPanel = lazy(() => import('@/pages/AdminPanel'));

const student = (page: React.ReactNode) => (
  <ProtectedRoute allowedRoles={['student']}>{page}</ProtectedRoute>
);

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* عمومی */}
        <Route path="/login" element={<Login />} />
        {/* ورودِ جداگانه‌ی والدین — فضای بزرگسال، با شماره و پیامک */}
        <Route path="/parent-login" element={<ParentLogin />} />
        {/* ثبت‌نامِ جدا بازنشسته شد؛ فقط لینک‌های قدیمی را نگه می‌دارد */}
        <Route path="/register" element={<Register />} />

        {/* دانش‌آموز */}
        <Route path="/" element={student(<Home />)} />
        <Route path="/books" element={student(<GameHall />)} />
        {/* نقشه‌ی کتابیِ قدیمی بازنشسته شد؛ هر لینکِ قدیمی به مسیرِ سیزن می‌رود */}
        <Route path="/book/:id" element={<Navigate to="/books" replace />} />
        <Route path="/game/:gameId" element={student(<BookGame />)} />
        <Route path="/luko-club" element={student(<LukoClub />)} />
        <Route path="/luko-podcast" element={student(<LukoPodcast />)} />
        <Route path="/luko-health" element={student(<LukoHealth />)} />
        <Route path="/garden" element={student(<Garden />)} />
        <Route path="/profile" element={student(<Profile />)} />

        {/* سایر نقش‌ها */}
        <Route
          path="/parent-panel"
          element={<ProtectedRoute allowedRoles={['parent']}><ParentPanel /></ProtectedRoute>}
        />
        <Route
          path="/teacher-panel"
          element={<ProtectedRoute allowedRoles={['teacher']}><TeacherPanel /></ProtectedRoute>}
        />
        <Route
          path="/school-panel"
          element={<ProtectedRoute allowedRoles={['school_admin']}><SchoolPanel /></ProtectedRoute>}
        />
        <Route
          path="/admin-panel"
          element={<ProtectedRoute allowedRoles={['team_admin']}><AdminPanel /></ProtectedRoute>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
