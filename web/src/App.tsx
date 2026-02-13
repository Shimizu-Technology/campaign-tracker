import { BrowserRouter, Link, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import ThankYouPage from './pages/ThankYouPage';
import DashboardPage from './pages/admin/DashboardPage';
import SupportersPage from './pages/admin/SupportersPage';
import SupporterDetailPage from './pages/admin/SupporterDetailPage';
import StaffEntryPage from './pages/admin/StaffEntryPage';
import VillageDetailPage from './pages/admin/VillageDetailPage';
import EventsPage from './pages/admin/EventsPage';
import EventDetailPage from './pages/admin/EventDetailPage';
import CheckInPage from './pages/admin/CheckInPage';
import QRCodePage from './pages/admin/QRCodePage';
import LeaderboardPage from './pages/admin/LeaderboardPage';
import PollWatcherPage from './pages/admin/PollWatcherPage';
import WarRoomPage from './pages/admin/WarRoomPage';
import SmsPage from './pages/admin/SmsPage';
import UsersPage from './pages/admin/UsersPage';
import QuotaSettingsPage from './pages/admin/QuotaSettingsPage';
import PrecinctSettingsPage from './pages/admin/PrecinctSettingsPage';
import AdminLayout from './components/AdminLayout';
import { useSession } from './hooks/useSession';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchInterval: 30_000 },
  },
});

function AdminRoute({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

function PermissionRoute({
  permission,
  children,
}: {
  permission:
    | 'can_manage_users'
    | 'can_manage_configuration'
    | 'can_send_sms'
    | 'can_view_supporters'
    | 'can_create_staff_supporters'
    | 'can_access_events'
    | 'can_access_qr'
    | 'can_access_leaderboard'
    | 'can_access_war_room'
    | 'can_access_poll_watcher';
  children: React.ReactNode;
}) {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg">Loading permissions...</div>
      </div>
    );
  }

  if (!data?.permissions?.[permission]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] px-4">
        <div className="app-card p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Not Authorized</h1>
          <p className="text-sm text-gray-600 mb-4">Your role does not have access to this tool.</p>
          <Link to="/admin" className="inline-flex items-center justify-center bg-[#1B3A6B] text-white px-4 py-2 rounded-xl min-h-[44px]">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public — no auth required */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signup/:leaderCode" element={<SignupPage />} />
          <Route path="/thank-you" element={<ThankYouPage />} />

          {/* Admin — requires Clerk auth */}
          <Route path="/admin" element={<AdminRoute><DashboardPage /></AdminRoute>} />
          <Route
            path="/admin/supporters"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_view_supporters">
                  <SupportersPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/supporters/:id"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_view_supporters">
                  <SupporterDetailPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/supporters/new"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_create_staff_supporters">
                  <StaffEntryPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/villages/:id"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_view_supporters">
                  <VillageDetailPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/events"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_access_events">
                  <EventsPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/events/:id"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_access_events">
                  <EventDetailPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/events/:id/checkin"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_access_events">
                  <CheckInPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/qr"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_access_qr">
                  <QRCodePage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/leaderboard"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_access_leaderboard">
                  <LeaderboardPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/poll-watcher"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_access_poll_watcher">
                  <PollWatcherPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/war-room"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_access_war_room">
                  <WarRoomPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/sms"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_send_sms">
                  <SmsPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_manage_users">
                  <UsersPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/quotas"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_manage_configuration">
                  <QuotaSettingsPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/precincts"
            element={
              <AdminRoute>
                <PermissionRoute permission="can_manage_configuration">
                  <PrecinctSettingsPage />
                </PermissionRoute>
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
