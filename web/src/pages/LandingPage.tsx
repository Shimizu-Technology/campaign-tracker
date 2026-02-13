import { Link } from 'react-router-dom';
import { Users, BarChart3, ClipboardList } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getStats } from '../lib/api';

export default function LandingPage() {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 60_000,
  });

  const totalSupporters = data?.total_supporters || 0;

  return (
    <div className="min-h-screen bg-linear-to-br from-[#1B3A6B] to-[#0f2340] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-blue-200/80">Campaign Ops Platform</p>
            <p className="text-sm text-blue-200">Guam 2026</p>
          </div>
          <Link
            to="/admin"
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium min-h-[44px] flex items-center"
          >
            Staff Dashboard
          </Link>
        </div>

        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-3">
            Josh & Tina 2026
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-2">
            Campaign Supporter Tracker
          </p>
          <p className="text-base md:text-lg text-blue-200/90 max-w-2xl mx-auto">
            Join a people-powered campaign movement for Guam. Sign up to support, stay informed, and help us build momentum.
          </p>
          {totalSupporters > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur px-5 py-2.5 rounded-full border border-white/10">
              <Users className="w-4 h-4 text-blue-200" />
              <span className="text-xl font-bold">{totalSupporters.toLocaleString()}</span>
              <span className="text-blue-200 text-sm">supporters and counting</span>
            </div>
          )}
        </div>

        <div className="text-center mb-12">
          <Link
            to="/signup"
            className="inline-block bg-[#C41E3A] hover:bg-[#a01830] text-white text-lg font-semibold px-10 py-4 rounded-2xl shadow-lg transition-all hover:-translate-y-0.5"
          >
            Sign Up to Support Josh & Tina
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5 mb-8">
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur p-6 text-center">
            <Users className="w-10 h-10 mx-auto mb-4 text-blue-200" />
            <h3 className="text-xl font-semibold mb-2">Show Your Support</h3>
            <p className="text-blue-100/90 text-sm">
              Add your name in seconds and let the campaign know you are with Josh and Tina.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur p-6 text-center">
            <BarChart3 className="w-10 h-10 mx-auto mb-4 text-blue-200" />
            <h3 className="text-xl font-semibold mb-2">Stay Informed</h3>
            <p className="text-blue-100/90 text-sm">
              Receive campaign updates, announcements, and key moments as election season moves forward.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur p-6 text-center">
            <ClipboardList className="w-10 h-10 mx-auto mb-4 text-blue-200" />
            <h3 className="text-xl font-semibold mb-2">Join Events</h3>
            <p className="text-blue-100/90 text-sm">
              Volunteer, attend rallies and motorcades, and help bring more voices into the campaign.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
