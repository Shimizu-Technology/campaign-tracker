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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchInterval: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signup/:leaderCode" element={<SignupPage />} />
          <Route path="/thank-you" element={<ThankYouPage />} />

          {/* Admin */}
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/supporters" element={<SupportersPage />} />
          <Route path="/admin/supporters/new" element={<StaffEntryPage />} />
          <Route path="/admin/villages/:id" element={<VillageDetailPage />} />
          <Route path="/admin/events" element={<EventsPage />} />
          <Route path="/admin/events/:id" element={<EventDetailPage />} />
          <Route path="/admin/events/:id/checkin" element={<CheckInPage />} />
          <Route path="/admin/qr" element={<QRCodePage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
