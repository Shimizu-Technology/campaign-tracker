import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../lib/api';
import { Link } from 'react-router-dom';
import { Users, MapPin, TrendingUp, CalendarPlus, ClipboardPlus, BarChart3, QrCode, Trophy, MessageSquare, Shield, ChevronDown, Target, Copy, Upload, Mail, ShieldCheck } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { useCampaignUpdates } from '../../hooks/useCampaignUpdates';
import { useSession } from '../../hooks/useSession';

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

interface DashboardSummary {
  total_supporters: number;
  total_target: number;
  total_percentage: number;
  total_registered_voters: number;
  total_villages: number;
  total_precincts: number;
  today_signups: number;
  week_signups: number;
  status: 'on_track' | 'behind' | 'critical';
}

interface DashboardPayload {
  campaign?: {
    id?: number;
    name?: string;
    candidate_names?: string;
  };
  summary?: Partial<DashboardSummary>;
  stats?: Partial<DashboardSummary>;
  villages?: VillageData[];
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
  useCampaignUpdates(); // Auto-invalidates dashboard queries on real-time events
  const { data: sessionData } = useSession();

  const { data, isLoading, isError } = useQuery<DashboardPayload>({
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

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <Users className="w-12 h-12 text-[#1B3A6B] mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Can't connect to server</h2>
          <p className="text-gray-500 mb-4">Check your connection and try again.</p>
          <button onClick={() => window.location.reload()} className="bg-[#1B3A6B] text-white px-4 py-2 rounded-lg hover:bg-[#152e55]">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const campaign = data.campaign;
  const summarySource = data.summary || data.stats || {};
  const summary: DashboardSummary = {
    total_supporters: Number(summarySource.total_supporters || 0),
    total_target: Number(summarySource.total_target || 0),
    total_percentage: Number(summarySource.total_percentage || 0),
    total_registered_voters: Number(summarySource.total_registered_voters || 0),
    total_villages: Number(summarySource.total_villages || 0),
    total_precincts: Number(summarySource.total_precincts || 0),
    today_signups: Number(summarySource.today_signups || 0),
    week_signups: Number(summarySource.week_signups || 0),
    status: (summarySource.status as DashboardSummary['status']) || 'critical',
  };
  const villages = Array.isArray(data.villages) ? data.villages : [];
  const primaryActions = [
    ...(sessionData?.permissions?.can_create_staff_supporters
      ? [ { to: '/admin/supporters/new', label: 'New Entry', icon: ClipboardPlus, className: 'bg-[#C41E3A] hover:bg-[#a01830]' } ]
      : []),
    ...(sessionData?.permissions?.can_view_supporters
      ? [ { to: '/admin/supporters', label: 'Supporters', icon: Users, className: 'bg-white/10 hover:bg-white/20' } ]
      : []),
    ...(sessionData?.permissions?.can_access_events
      ? [ { to: '/admin/events', label: 'Events', icon: CalendarPlus, className: 'bg-white/10 hover:bg-white/20' } ]
      : []),
    ...(sessionData?.permissions?.can_access_war_room
      ? [ { to: '/admin/war-room', label: 'War Room', icon: TrendingUp, className: 'bg-[#C41E3A]/80 hover:bg-[#C41E3A]' } ]
      : []),
  ] as const;
  const secondaryActions = [
    ...(sessionData?.permissions?.can_access_qr ? [ { to: '/admin/qr', label: 'QR', icon: QrCode } ] : []),
    ...(sessionData?.permissions?.can_access_poll_watcher ? [ { to: '/admin/poll-watcher', label: 'Poll Watcher', icon: MapPin } ] : []),
    ...(sessionData?.permissions?.can_access_leaderboard ? [ { to: '/admin/leaderboard', label: 'Top', icon: Trophy } ] : []),
    ...(sessionData?.permissions?.can_send_sms ? [ { to: '/admin/sms', label: 'SMS', icon: MessageSquare } ] : []),
    ...(sessionData?.permissions?.can_send_email ? [ { to: '/admin/email', label: 'Email', icon: Mail } ] : []),
    ...(sessionData?.permissions?.can_manage_users ? [ { to: '/admin/users', label: 'Users', icon: Shield } ] : []),
    ...(sessionData?.permissions?.can_manage_configuration ? [ { to: '/admin/quotas', label: 'Quotas', icon: Target } ] : []),
    ...(sessionData?.permissions?.can_manage_configuration ? [ { to: '/admin/precincts', label: 'Precincts', icon: MapPin } ] : []),
    ...(sessionData?.permissions?.can_edit_supporters ? [ { to: '/admin/import', label: 'Import', icon: Upload } ] : []),
    ...(sessionData?.permissions?.can_view_supporters ? [ { to: '/admin/vetting', label: 'Vetting', icon: ShieldCheck, badge: sessionData?.counts?.pending_vetting || 0 } ] : []),
    ...(sessionData?.permissions?.can_view_supporters ? [ { to: '/admin/duplicates', label: 'Duplicates', icon: Copy } ] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Header */}
      <header className="bg-[#1B3A6B] text-white py-3 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2 sm:mb-0">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{campaign?.name || 'Campaign Tracker'}</h1>
              <p className="text-blue-200 text-sm truncate">{campaign?.candidate_names}</p>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {primaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className={`${action.className} px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center justify-center gap-2 shadow-sm`}
                  >
                    <Icon className="w-4 h-4" /> {action.label}
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:flex flex-wrap gap-2">
              {secondaryActions.map((action) => {
                const Icon = action.icon;
                const badge = 'badge' in action ? (action as { badge: number }).badge : 0;
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="bg-white/10 hover:bg-white/20 px-3 py-2 min-h-[44px] rounded-xl text-xs font-medium flex items-center gap-1.5"
                  >
                    <Icon className="w-3.5 h-3.5" /> {action.label}
                    {badge > 0 && (
                      <span className="bg-[#C41E3A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <details className="md:hidden bg-white/10 rounded-xl">
              <summary className="list-none cursor-pointer px-3 py-2 min-h-[44px] text-sm font-medium flex items-center justify-between">
                More Tools
                <ChevronDown className="w-4 h-4" />
              </summary>
              <div className="grid grid-cols-2 gap-2 px-2 pb-2">
                {secondaryActions.map((action) => {
                  const Icon = action.icon;
                  const badge = 'badge' in action ? (action as { badge: number }).badge : 0;
                  return (
                    <Link
                      key={action.to}
                      to={action.to}
                      className="bg-white/10 hover:bg-white/20 px-2.5 py-2 min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                    >
                      <Icon className="w-3.5 h-3.5" /> {action.label}
                      {badge > 0 && (
                        <span className="bg-[#C41E3A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="app-card p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Users className="w-4 h-4" /> Total Supporters
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.total_supporters.toLocaleString()}</div>
            <div className="text-sm text-gray-500">of {summary.total_target.toLocaleString()} goal</div>
          </div>
          <div className="app-card p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Progress
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.total_percentage}%</div>
            <div className={`text-sm ${summary.status === 'on_track' ? 'text-green-600' : summary.status === 'behind' ? 'text-yellow-600' : 'text-red-600'}`}>
              {summary.status === 'on_track' ? 'On Track' : summary.status === 'behind' ? 'Behind' : 'Critical'}
            </div>
          </div>
          <div className="app-card p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <BarChart3 className="w-4 h-4" /> Today
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.today_signups}</div>
            <div className="text-sm text-gray-500">{summary.week_signups} this week</div>
          </div>
          <div className="app-card p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <MapPin className="w-4 h-4" /> Coverage
            </div>
            <div className="text-3xl font-bold text-gray-900">{summary.total_villages}</div>
            <div className="text-sm text-gray-500">{summary.total_precincts} precincts</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="app-card p-4 mb-8">
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
        <h2 className="app-section-title text-2xl mb-4">Village Progress</h2>
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

      </div>
    </div>
  );
}
