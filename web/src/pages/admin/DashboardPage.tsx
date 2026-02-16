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

function statusBarColor(status: string) {
  if (status === 'on_track') return 'bg-emerald-500';
  if (status === 'behind') return 'bg-amber-500';
  return 'bg-red-500';
}

function statusTextColor(status: string) {
  if (status === 'on_track') return 'text-emerald-600';
  if (status === 'behind') return 'text-amber-600';
  return 'text-red-600';
}

function statusLabel(status: string) {
  if (status === 'on_track') return 'On Track';
  if (status === 'behind') return 'Behind';
  return 'Critical';
}

function statusCardBorder(status: string) {
  if (status === 'on_track') return 'border-emerald-200 hover:border-emerald-300';
  if (status === 'behind') return 'border-amber-200 hover:border-amber-300';
  return 'border-red-200 hover:border-red-300';
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
      <div className="flex items-center justify-center py-32 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <Users className="w-8 h-8 text-neutral-400" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Can&apos;t connect to server</h2>
          <p className="text-neutral-500 mb-6 text-sm leading-relaxed">Check your connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-[var(--campaign-blue)] text-white rounded-xl font-medium hover:opacity-90 transition-all duration-200 hover:shadow-lg hover:shadow-[var(--campaign-blue)]/20 hover:-translate-y-0.5 active:translate-y-0"
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
      iconBg: 'bg-blue-50',
      iconColor: 'text-[var(--campaign-blue)]',
    },
    {
      label: 'Progress',
      value: `${summary.total_percentage}%`,
      sub: statusLabel(summary.status),
      subColor: statusTextColor(summary.status),
      icon: TrendingUp,
      iconBg: summary.status === 'on_track' ? 'bg-emerald-50' : summary.status === 'behind' ? 'bg-amber-50' : 'bg-red-50',
      iconColor: statusTextColor(summary.status),
    },
    {
      label: 'Today',
      value: String(summary.today_signups),
      sub: `${summary.week_signups} this week`,
      icon: BarChart3,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Coverage',
      value: String(summary.total_villages),
      sub: `${summary.total_precincts} precincts`,
      icon: MapPin,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Island-wide campaign progress overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="app-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${card.iconColor}`} />
                </div>
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{card.label}</span>
              </div>
              <div className="text-3xl font-bold text-neutral-900 tracking-tight">{card.value}</div>
              <div className={`text-sm mt-1 font-medium ${card.subColor || 'text-neutral-400'}`}>
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Progress Bar */}
      <div className="app-card p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-neutral-800">Island-Wide Progress</span>
          <span className="text-sm text-neutral-500 font-medium tabular-nums">
            {summary.total_supporters.toLocaleString()} / {summary.total_target.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-700 ease-out ${statusBarColor(summary.status)}`}
            style={{ width: `${Math.min(summary.total_percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Village Grid */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Village Progress</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{villages.length} villages across the island</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {villages.map((v: VillageData) => (
          <Link
            key={v.id}
            to={`/admin/villages/${v.id}`}
            className={`group block app-card p-4 ${statusCardBorder(v.status)} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-neutral-800 group-hover:text-[var(--campaign-blue)] transition-colors text-[15px]">
                {v.name}
              </h3>
              <span className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider">{v.region}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2.5">
              <span className="text-neutral-500 font-medium tabular-nums">{v.supporter_count} / {v.quota_target}</span>
              <span className={`font-semibold tabular-nums ${statusTextColor(v.status)}`}>{v.quota_percentage}%</span>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${statusBarColor(v.status)}`}
                style={{ width: `${Math.min(v.quota_percentage, 100)}%` }}
              />
            </div>
            <div className="mt-2.5 flex justify-between text-[11px] text-neutral-400">
              <span>{v.registered_voters.toLocaleString()} registered voters</span>
              {v.today_count > 0 && <span className="text-emerald-600 font-medium">+{v.today_count} today</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
