import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MFASetupPage from "./pages/MFASetupPage.jsx";
import MFAVerifyPage from "./pages/MFAVerifyPage.jsx";
import DashboardLayout from "./pages/dashboard/DashboardLayout.jsx";
import OverviewPage from "./pages/dashboard/OverviewPage.jsx";
import FacultyPage from "./pages/dashboard/FacultyPage.jsx";
import AchievementsPage from "./pages/dashboard/AchievementsPage.jsx";
import ReviewQueuePage from "./pages/dashboard/ReviewQueuePage.jsx";
import DepartmentsPage from "./pages/dashboard/DepartmentsPage.jsx";
import ReportsPage from "./pages/dashboard/ReportsPage.jsx";
import AlumniPage from "./pages/dashboard/AlumniPage.jsx";
import SubmitAchievementPage from "./pages/dashboard/SubmitAchievementPage.jsx";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-400 text-sm">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mfa/setup" element={<MFASetupPage />} />
      <Route path="/mfa/verify" element={<MFAVerifyPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="faculty" element={<FacultyPage />} />
        <Route path="achievements" element={<AchievementsPage />} />
        <Route path="achievements/submit" element={<SubmitAchievementPage />} />
        <Route path="review" element={<ReviewQueuePage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="alumni" element={<AlumniPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
