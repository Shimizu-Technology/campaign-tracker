import { useQuery } from '@tanstack/react-query';
import { getDashboard, getSprintGoals } from '../../lib/api';
import { Link } from 'react-router-dom';
import { Users, MapPin, TrendingUp, BarChart3, Target, Calendar } from 'lucide-react';
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
  pace_expected: number;
  pace_diff: number;
  pace_status: string;
  pace_weekly_needed: number;
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
  pace_expected: number;
  pace_diff: number;
  pace_status: string;
  pace_weekly_needed: number;
}

interface DashboardPayload {
  campaign?: {
    id?: number;
    name?: string;
    candidate_names?: string;
    show_pace?: boolean;
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
  if (status === 'on_track') return 'text-emerald-400';
  if (status === 'behind') return 'text-amber-400';
  return 'text-red-400';
}

function paceColor(paceStatus: string) {
  if (paceStatus === 'ahead' || paceStatus === 'complete') return 'text-emerald-600';
  if (paceStatus === 'slightly_behind') return 'text-amber-600';
  if (paceStatus === 'behind' || paceStatus === 'overdue') return 'text-red-600';
  return 'text-gray-500';
}

function paceLabel(diff: number, status: string) {
  if (status === 'no_target' || status === 'no_deadline') return '—';
  if (status === 'complete') return '✓ Goal reached';
  if (status === 'overdue') return `${Math.abs(diff)} short`;
  if (diff >= 0) return `${diff} ahead`;
  return `${Math.abs(diff)} behind`;
}

const RENDER_TIME = Date.now();

export default function DashboardPage() {

  const { data: sprintGoals } = useQuery<Array<{
    id: number; title: string; village_name: string | null; target_count: number;
    current_count: number; end_date: string; progress_percentage: number;
  }>>({
    queryKey: ['sprint_goals', 'active'],
    queryFn: () => getSprintGoals({ status: 'active' }),
  });

  const { data, isLoading, isError } = useQuery<DashboardPayload>({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center py-32 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--surface-overlay)] flex items-center justify-center">
            <Users className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Can&apos;t connect to server</h2>
          <p className="text-[var(--text-secondary)] mb-6 text-sm leading-relaxed">Check your connection and try again.</p>
          <button onClick={() => window.location.reload()} className="app-btn-primary">
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
    pace_expected: Number(summarySource.pace_expected || 0),
    pace_diff: Number(summarySource.pace_diff || 0),
    pace_status: (summarySource.pace_status as string) || 'no_target',
    pace_weekly_needed: Number(summarySource.pace_weekly_needed || 0),
  };
  const villages = Array.isArray(data.villages) ? data.villages : [];
  const showPace = data.campaign?.show_pace === true;

  const statCards = [
    {
      label: 'Total Supporters',
      value: summary.total_supporters.toLocaleString(),
      sub: `of ${summary.total_target.toLocaleString()} goal`,
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-400',
    },
    ...(showPace ? [ {
      label: 'Pace',
      value: paceLabel(summary.pace_diff, summary.pace_status),
      sub: summary.pace_weekly_needed > 0 ? `${summary.pace_weekly_needed}/week needed` : `${summary.total_percentage}% complete`,
      subColor: paceColor(summary.pace_status),
      icon: TrendingUp,
      iconBg: summary.pace_status === 'ahead' || summary.pace_status === 'complete' ? 'bg-green-50' : summary.pace_status === 'slightly_behind' ? 'bg-amber-50' : 'bg-red-50',
      iconColor: paceColor(summary.pace_status),
    } ] : []),
    {
      label: 'Today',
      value: String(summary.today_signups),
      sub: `${summary.week_signups} this week`,
      icon: BarChart3,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-400',
    },
    {
      label: 'Coverage',
      value: String(summary.total_villages),
      sub: `${summary.total_precincts} precincts`,
      icon: MapPin,
      iconBg: 'bg-teal-500/10',
      iconColor: 'text-teal-400',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Island-wide campaign progress overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="app-card app-card-hover p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-[18px] h-[18px] ${card.iconColor}`} />
                </div>
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{card.label}</span>
              </div>
              <div className="text-3xl font-bold text-[var(--text-primary)] tracking-tight tabular-nums">{card.value}</div>
              <div className={`text-sm mt-1 font-medium ${card.subColor || 'text-[var(--text-secondary)]'}`}>
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Progress Bar */}
      <div className="app-card p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Island-Wide Progress</span>
          <span className="text-sm text-[var(--text-secondary)] font-medium tabular-nums">
            {summary.total_supporters.toLocaleString()} / {summary.total_target.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-[var(--surface-overlay)] rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-700 ease-out ${statusBarColor(summary.status)}`}
            style={{ width: `${Math.min(summary.total_percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Sprint Goals */}
      {sprintGoals && sprintGoals.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-[var(--text-muted)]" />
              Sprint Goals
            </h2>
            <Link to="/admin/sprint-goals" className="text-xs font-medium text-blue-400 hover:text-blue-300">
              View all
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sprintGoals.map((goal) => {
              const daysLeft = Math.ceil((new Date(goal.end_date).getTime() - RENDER_TIME) / (1000 * 60 * 60 * 24));
              const pct = goal.progress_percentage;
              const barColor = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
              const textColor = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
              return (
                <div key={goal.id} className="app-card p-4">
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1 truncate">{goal.title}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mb-2">
                    <span>{goal.village_name || 'Campaign-wide'}</span>
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Last day' : `${daysLeft}d left`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[var(--text-secondary)] tabular-nums">{goal.current_count} / {goal.target_count}</span>
                    <span className={`font-semibold tabular-nums ${textColor}`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-[var(--surface-overlay)] rounded-full h-2 overflow-hidden">
                    <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Village Grid */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Village Progress</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{villages.length} villages across the island</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {villages.map((v: VillageData) => (
          <Link
            key={v.id}
            to={`/admin/villages/${v.id}`}
            className="group block app-card app-card-hover p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-blue-400 transition-colors text-[15px]">
                {v.name}
              </h3>
              <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider">{v.region}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2.5">
              <span className="text-[var(--text-secondary)] font-medium tabular-nums">{v.supporter_count} / {v.quota_target}</span>
              <span className={`font-semibold tabular-nums ${statusTextColor(v.status)}`}>{v.quota_percentage}%</span>
            </div>
            <div className="w-full bg-[var(--surface-overlay)] rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${statusBarColor(v.status)}`}
                style={{ width: `${Math.min(v.quota_percentage, 100)}%` }}
              />
            </div>
            <div className="mt-2.5 flex justify-between text-[11px] text-[var(--text-muted)]">
              {showPace ? (
                <>
                  <span className={`font-medium ${paceColor(v.pace_status)}`}>
                    {paceLabel(v.pace_diff, v.pace_status)}
                  </span>
                  {v.pace_weekly_needed > 0 && (
                    <span>{v.pace_weekly_needed}/wk needed</span>
                  )}
                </>
              ) : (
                <span>{v.registered_voters.toLocaleString()} registered voters</span>
              )}
              {v.today_count > 0 && <span className="text-emerald-600 font-medium">+{v.today_count} today</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
