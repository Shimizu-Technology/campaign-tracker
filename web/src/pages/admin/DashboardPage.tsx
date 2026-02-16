import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../lib/api';
import { Link } from 'react-router-dom';
import { Users, MapPin, TrendingUp, BarChart3 } from 'lucide-react';
import { useCampaignUpdates } from '../../hooks/useCampaignUpdates';
import DashboardSkeleton from '../../components/DashboardSkeleton';

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
  if (status === 'on_track') return 'bg-emerald-500';
  if (status === 'behind') return 'bg-amber-500';
  return 'bg-red-500';
}

function statusTextColor(status: string) {
  if (status === 'on_track') return 'text-emerald-400';
  if (status === 'behind') return 'text-amber-400';
  return 'text-red-400';
}

function statusLabel(status: string) {
  if (status === 'on_track') return 'On Track';
  if (status === 'behind') return 'Behind';
  return 'Critical';
}

function statusBorder(status: string) {
  if (status === 'on_track') return 'border-emerald-500/30';
  if (status === 'behind') return 'border-amber-500/30';
  return 'border-red-500/30';
}

export default function DashboardPage() {
  useCampaignUpdates();

  const { data, isLoading, isError } = useQuery<DashboardPayload>({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8">
          <Users className="w-12 h-12 text-blue-400/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Can&apos;t connect to server</h2>
          <p className="text-blue-200/50 mb-4">Check your connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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

  const statCards = [
    {
      label: 'Total Supporters',
      value: summary.total_supporters.toLocaleString(),
      sub: `of ${summary.total_target.toLocaleString()} goal`,
      icon: Users,
    },
    {
      label: 'Progress',
      value: `${summary.total_percentage}%`,
      sub: statusLabel(summary.status),
      subColor: statusTextColor(summary.status),
      icon: TrendingUp,
    },
    {
      label: 'Today',
      value: String(summary.today_signups),
      sub: `${summary.week_signups} this week`,
      icon: BarChart3,
    },
    {
      label: 'Coverage',
      value: String(summary.total_villages),
      sub: `${summary.total_precincts} precincts`,
      icon: MapPin,
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white/5 border border-white/8 rounded-xl p-4 hover:bg-white/8 transition-colors"
            >
              <div className="flex items-center gap-2 text-blue-300/50 text-xs font-medium mb-2">
                <Icon className="w-3.5 h-3.5" />
                {card.label}
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{card.value}</div>
              <div className={`text-sm mt-0.5 ${card.subColor || 'text-blue-200/40'}`}>
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Progress Bar */}
      <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-white text-sm">Island-Wide Progress</span>
          <span className="text-sm text-blue-200/50">
            {summary.total_supporters.toLocaleString()} / {summary.total_target.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${statusColor(summary.status)}`}
            style={{ width: `${Math.min(summary.total_percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Village Grid */}
      <h2 className="text-lg font-bold text-white mb-4">Village Progress</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {villages.map((v: VillageData) => (
          <Link
            key={v.id}
            to={`/admin/villages/${v.id}`}
            className={`block bg-white/5 border ${statusBorder(v.status)} rounded-xl p-4 hover:bg-white/8 transition-all group`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white group-hover:text-blue-200 transition-colors">{v.name}</h3>
              <span className="text-xs text-blue-300/40 font-medium">{v.region}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-blue-200/50 mb-2">
              <span>{v.supporter_count} / {v.quota_target}</span>
              <span className="font-medium text-blue-200/70">{v.quota_percentage}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${statusColor(v.status)}`}
                style={{ width: `${Math.min(v.quota_percentage, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-blue-300/30">
              <span>{v.registered_voters.toLocaleString()} voters</span>
              {v.today_count > 0 && <span className="text-emerald-400">+{v.today_count} today</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
