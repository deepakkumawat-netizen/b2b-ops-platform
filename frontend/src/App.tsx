import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './app/RequireAuth';
import { StaffLayout } from './app/StaffLayout';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SchoolsListPage } from './features/schools/SchoolsListPage';
import { NewSchoolPage } from './features/schools/NewSchoolPage';
import { SchoolDetailPage } from './features/schools/SchoolDetailPage';
import { AgentSuggestionsPage } from './features/agent-suggestions/AgentSuggestionsPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
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
  );
}
