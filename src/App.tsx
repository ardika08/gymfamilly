import { Suspense, lazy, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { RootLayout } from './components/layout/RootLayout';
import { useAuth } from './context/AuthContext';
import { AdminAttendancePage } from './pages/admin/AdminAttendancePage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminMembersPage } from './pages/admin/AdminMembersPage';
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage';
import { AdminPackagesPage } from './pages/admin/AdminPackagesPage';
import { AdminPaymentsPage } from './pages/admin/AdminPaymentsPage';
import { AdminScannerPage } from './pages/admin/AdminScannerPage';
import { AdminVouchersPage } from './pages/admin/AdminVouchersPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { MemberAttendancePage } from './pages/member/MemberAttendancePage';
import { MemberBarcodePage } from './pages/member/MemberBarcodePage';
import { MemberDashboardPage } from './pages/member/MemberDashboardPage';
import { MemberMessagesPage } from './pages/member/MemberMessagesPage';
import { MemberPackagesPage } from './pages/member/MemberPackagesPage';
import { MemberPaymentsPage } from './pages/member/MemberPaymentsPage';
import { LandingPage } from './pages/public/LandingPage';
import { PublicPackagesPage } from './pages/public/PublicPackagesPage';
import { authService } from './services/api';

const AdminFinancePage = lazy(() =>
  import('./pages/admin/AdminFinancePage').then((module) => ({
    default: module.AdminFinancePage,
  })),
);

const ProtectedRoute = ({
  allow,
  children,
}: {
  allow: 'admin' | 'member';
  children: ReactElement;
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Memuat aplikasi...</div>;
  }

  if (!user && authService.hasSession()) {
    return <div className="loading-screen">Memulihkan sesi login...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allow) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/member'} replace />;
  }

  return children;
};

const AuthRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Memuat aplikasi...</div>;
  }

  if (!user && authService.hasSession()) {
    return <div className="loading-screen">Memulihkan sesi login...</div>;
  }

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/member'} replace />;
  }

  return null;
};

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="packages" element={<PublicPackagesPage />} />
        <Route
          path="login"
          element={
            <>
              <AuthRedirect />
              <LoginPage />
            </>
          }
        />
        <Route
          path="register"
          element={
            <>
              <AuthRedirect />
              <RegisterPage />
            </>
          }
        />
      </Route>
      <Route
        path="member"
        element={
          <ProtectedRoute allow="member">
            <DashboardLayout mode="member" />
          </ProtectedRoute>
        }
      >
        <Route index element={<MemberDashboardPage />} />
        <Route path="packages" element={<MemberPackagesPage />} />
        <Route path="payments" element={<MemberPaymentsPage />} />
        <Route path="barcode" element={<MemberBarcodePage />} />
        <Route path="attendance" element={<MemberAttendancePage />} />
        <Route path="messages" element={<MemberMessagesPage />} />
      </Route>
      <Route
        path="admin"
        element={
          <ProtectedRoute allow="admin">
            <DashboardLayout mode="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route
          path="finance"
          element={
            <Suspense fallback={<div className="loading-screen">Memuat keuangan...</div>}>
              <AdminFinancePage />
            </Suspense>
          }
        />
        <Route path="members" element={<AdminMembersPage />} />
        <Route path="payments" element={<AdminPaymentsPage />} />
        <Route path="packages" element={<AdminPackagesPage />} />
        <Route path="messages" element={<AdminMessagesPage />} />
        <Route path="attendance" element={<AdminAttendancePage />} />
        <Route path="scanner" element={<AdminScannerPage />} />
        <Route path="vouchers" element={<AdminVouchersPage />} />
      </Route>
    </Routes>
  );
}
