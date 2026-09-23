import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './app/RequireAuth';
import { StaffLayout } from './app/StaffLayout';

const LandingPage = lazy(() => import('./features/landing/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./features/auth/SignupPage').then((m) => ({ default: m.SignupPage })));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SchoolsListPage = lazy(() => import('./features/schools/SchoolsListPage').then((m) => ({ default: m.SchoolsListPage })));
// The one page that pulls in country-state-city's full world dataset — the
// single largest chunk of the old bundle. Splitting it out means everyone
// who never adds a school (most visits) never downloads it.
const NewSchoolPage = lazy(() => import('./features/schools/NewSchoolPage').then((m) => ({ default: m.NewSchoolPage })));
const SchoolDetailPage = lazy(() => import('./features/schools/SchoolDetailPage').then((m) => ({ default: m.SchoolDetailPage })));
const AgentSuggestionsPage = lazy(() =>
  import('./features/agent-suggestions/AgentSuggestionsPage').then((m) => ({ default: m.AgentSuggestionsPage })),
);

function RouteFallback() {
  return <p className="muted" style={{ padding: 24 }}>Loading…</p>;
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<StaffLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/schools" element={<SchoolsListPage />} />
            <Route path="/schools/new" element={<NewSchoolPage />} />
            <Route path="/schools/:id" element={<SchoolDetailPage />} />
            <Route path="/agent-suggestions" element={<AgentSuggestionsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
