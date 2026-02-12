import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../lib/api';
import { Link } from 'react-router-dom';
import { Users, MapPin, TrendingUp, CalendarPlus, ClipboardPlus, BarChart3, QrCode, Trophy } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';

interface VillageData {
  id: number;
  name: string;
  region: string;
  registered_voters: number;
  supporter_count: number;
  today_count: number;
  week_count: number;
  quota_target: number;
  quota_percentage: number;
  status: 'on_track' | 'behind' | 'critical';
}

function statusColor(status: string) {
  if (status === 'on_track') return 'bg-green-500';
  if (status === 'behind') return 'bg-yellow-500';
  return 'bg-red-500';
}

function statusBg(status: string) {
  if (status === 'on_track') return 'bg-green-50 border-green-200';
  if (status === 'behind') return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  const { campaign, summary, villages } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1B3A6B] text-white py-3 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2 sm:mb-0">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate">{campaign?.name || 'Campaign Tracker'}</h1>
              <p className="text-blue-200 text-xs sm:text-sm truncate">{campaign?.candidate_names}</p>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
          <div className="flex gap-2 sm:gap-3 mt-2">
            <Link to="/admin/supporters/new" className="bg-[#C41E3A] hover:bg-[#a01830] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1">
              <ClipboardPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">New</span> Entry
            </Link>
            <Link to="/admin/qr" className="bg-white/10 hover:bg-white/20 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> QR
            </Link>
            <Link to="/admin/events" className="bg-white/10 hover:bg-white/20 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1">
              <CalendarPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Events
            </Link>
            <Link to="/admin/leaderboard" className="bg-yellow-500/80 hover:bg-yellow-500 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Top
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Users className="w-4 h-4" /> Total Supporters
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.total_supporters.toLocaleString()}</div>
            <div className="text-sm text-gray-500">of {summary.total_target.toLocaleString()} goal</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Progress
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.total_percentage}%</div>
            <div className={`text-sm ${summary.status === 'on_track' ? 'text-green-600' : summary.status === 'behind' ? 'text-yellow-600' : 'text-red-600'}`}>
              {summary.status === 'on_track' ? 'On Track' : summary.status === 'behind' ? 'Behind' : 'Critical'}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <BarChart3 className="w-4 h-4" /> Today
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.today_signups}</div>
            <div className="text-sm text-gray-500">{summary.week_signups} this week</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <MapPin className="w-4 h-4" /> Coverage
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.total_villages}</div>
            <div className="text-sm text-gray-500">{summary.total_precincts} precincts</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="bg-white rounded-xl shadow-sm p-4 border mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-700">Island-Wide Progress</span>
            <span className="text-sm text-gray-500">
              {summary.total_supporters.toLocaleString()} / {summary.total_target.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${statusColor(summary.status)}`}
              style={{ width: `${Math.min(summary.total_percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Village Grid */}
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Village Progress</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {villages.map((v: VillageData) => (
            <Link
              key={v.id}
              to={`/admin/villages/${v.id}`}
              className={`block rounded-xl shadow-sm p-4 border hover:shadow-md transition-shadow ${statusBg(v.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">{v.name}</h3>
                <span className="text-xs text-gray-500">{v.region}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>{v.supporter_count} / {v.quota_target}</span>
                <span className="font-medium">{v.quota_percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${statusColor(v.status)}`}
                  style={{ width: `${Math.min(v.quota_percentage, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>{v.registered_voters.toLocaleString()} voters</span>
                {v.today_count > 0 && <span className="text-green-600">+{v.today_count} today</span>}
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link to="/admin/supporters" className="text-[#1B3A6B] hover:underline text-sm">View All Supporters →</Link>
          <Link to="/admin/poll-watcher" className="text-[#1B3A6B] hover:underline text-sm">Poll Watcher →</Link>
          <Link to="/signup" className="text-[#1B3A6B] hover:underline text-sm">Public Signup Form →</Link>
        </div>
      </div>
    </div>
  );
}
