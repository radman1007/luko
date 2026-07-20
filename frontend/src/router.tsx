import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { PageLoader } from '@/components/PageLoader/PageLoader';

const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const CompleteProfile = lazy(() => import('@/pages/CompleteProfile'));

const Home = lazy(() => import('@/pages/Home'));
const Books = lazy(() => import('@/pages/Books'));
const BookGames = lazy(() => import('@/pages/BookGames'));
const BookGame = lazy(() => import('@/pages/BookGame'));
const LukoClub = lazy(() => import('@/pages/LukoClub'));
const LukoTV = lazy(() => import('@/pages/LukoTV'));
const LukoPodcast = lazy(() => import('@/pages/LukoPodcast'));
const LukoHealth = lazy(() => import('@/pages/LukoHealth'));
const Profile = lazy(() => import('@/pages/Profile'));
const TrafficGame = lazy(() => import('@/pages/TrafficGame'));
const CookingGame = lazy(() => import('@/pages/CookingGame'));

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
        <Route path="/register" element={<Register />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />

        {/* دانش‌آموز */}
        <Route path="/" element={student(<Home />)} />
        <Route path="/books" element={student(<Books />)} />
        <Route path="/book/:id" element={student(<BookGames />)} />
        <Route path="/game/:gameId" element={student(<BookGame />)} />
        <Route path="/luko-club" element={student(<LukoClub />)} />
        <Route path="/luko-tv" element={student(<LukoTV />)} />
        <Route path="/luko-podcast" element={student(<LukoPodcast />)} />
        <Route path="/luko-health" element={student(<LukoHealth />)} />
        <Route path="/profile" element={student(<Profile />)} />
        <Route path="/traffic-game/:ruleId" element={student(<TrafficGame />)} />
        <Route path="/cooking-game/:recipeId" element={student(<CookingGame />)} />

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
