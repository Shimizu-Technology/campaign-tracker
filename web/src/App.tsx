import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import ThankYouPage from './pages/ThankYouPage';
import DashboardPage from './pages/admin/DashboardPage';
import SupportersPage from './pages/admin/SupportersPage';
import StaffEntryPage from './pages/admin/StaffEntryPage';
import VillageDetailPage from './pages/admin/VillageDetailPage';
import EventsPage from './pages/admin/EventsPage';
import EventDetailPage from './pages/admin/EventDetailPage';
import CheckInPage from './pages/admin/CheckInPage';
import QRCodePage from './pages/admin/QRCodePage';
import LeaderboardPage from './pages/admin/LeaderboardPage';
import PollWatcherPage from './pages/admin/PollWatcherPage';
import WarRoomPage from './pages/admin/WarRoomPage';
import AdminLayout from './components/AdminLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchInterval: 30_000 },
  },
});

function AdminRoute({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
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
          <Route path="/admin/supporters" element={<AdminRoute><SupportersPage /></AdminRoute>} />
          <Route path="/admin/supporters/new" element={<AdminRoute><StaffEntryPage /></AdminRoute>} />
          <Route path="/admin/villages/:id" element={<AdminRoute><VillageDetailPage /></AdminRoute>} />
          <Route path="/admin/events" element={<AdminRoute><EventsPage /></AdminRoute>} />
          <Route path="/admin/events/:id" element={<AdminRoute><EventDetailPage /></AdminRoute>} />
          <Route path="/admin/events/:id/checkin" element={<AdminRoute><CheckInPage /></AdminRoute>} />
          <Route path="/admin/qr" element={<AdminRoute><QRCodePage /></AdminRoute>} />
          <Route path="/admin/leaderboard" element={<AdminRoute><LeaderboardPage /></AdminRoute>} />
          <Route path="/admin/poll-watcher" element={<AdminRoute><PollWatcherPage /></AdminRoute>} />
          <Route path="/admin/war-room" element={<AdminRoute><WarRoomPage /></AdminRoute>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
