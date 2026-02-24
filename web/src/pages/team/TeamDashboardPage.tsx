import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getDashboard, getGecStats, getReportsList, getCurrentCycle } from '../../lib/api';
import { useSession } from '../../hooks/useSession';
import {
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  Upload,
  Camera,
  ClipboardPlus,
  Database,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
} from 'lucide-react';

export default function TeamDashboardPage() {
  const { data: session } = useSession();
  const { data: dashboard, isLoading: dashLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  const { data: gecStats } = useQuery({ queryKey: ['gec-stats'], queryFn: getGecStats });
  const { data: reportsInfo } = useQuery({ queryKey: ['reports-list'], queryFn: getReportsList });
  const { data: cycleData } = useQuery({ queryKey: ['current-cycle'], queryFn: getCurrentCycle });

  const counts = session?.counts;
  const summary = dashboard?.summary;
  const quickStats = reportsInfo?.quick_stats;

  if (dashLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Data Team Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Voter operations and quota tracking</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Quota Eligible"
          value={summary?.quota_eligible_count ?? counts?.quota_eligible ?? 0}
          icon={CheckCircle}
          color="green"
          detail="Verified team input"
        />
        <StatCard
          label="Pending Vetting"
          value={(counts?.flagged_supporters || 0) + (counts?.pending_vetting || 0)}
          icon={ShieldCheck}
          color="amber"
          detail="Needs manual review"
          to="/team/vetting"
        />
        <StatCard
          label="Public Signups"
          value={counts?.public_signups_pending || 0}
          icon={UserCheck}
          color="blue"
          detail="Awaiting review"
          to="/team/public-review"
        />
        <StatCard
          label="Total Active"
          value={summary?.total || 0}
          icon={Users}
          color="gray"
          detail="All sources"
        />
      </div>

      {/* Current Quota Period */}
      {cycleData?.current_period && (() => {
        const p = cycleData.current_period;
        const pct = p.quota_target > 0 ? Math.round((p.eligible_count / p.quota_target) * 100) : 0;
        return (
          <div className={`rounded-xl border p-5 ${p.overdue ? 'bg-red-50 border-red-200' : p.due_soon ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">{p.name} Quota</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Due {new Date(p.due_date).toLocaleDateString()}
                  {p.overdue && <span className="text-red-600 font-semibold ml-1">OVERDUE</span>}
                  {p.due_soon && !p.overdue && <span className="text-amber-600 font-semibold ml-1">({p.days_until_due} days left)</span>}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{(p.eligible_count || 0).toLocaleString()}</div>
                <div className="text-xs text-gray-400">of {(p.quota_target || 0).toLocaleString()} target</div>
              </div>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
              <span>{pct}% complete</span>
              <span>{((p.quota_target || 0) - (p.eligible_count || 0)).toLocaleString()} remaining</span>
            </div>
          </div>
        );
      })()}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction to="/team/scan" icon={Camera} label="Scan Blue Form" />
          <QuickAction to="/team/entry" icon={ClipboardPlus} label="Manual Entry" />
          <QuickAction to="/team/import" icon={Upload} label="Excel Import" />
          <QuickAction to="/team/gec" icon={Database} label="GEC Voter List" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* GEC Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">GEC Voter List Status</h2>
            <Link to="/team/gec" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Manage</Link>
          </div>
          {gecStats ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Registered Voters</span>
                <span className="font-semibold text-gray-900">{(gecStats.total_voters || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Latest List Date</span>
                <span className="font-semibold text-gray-900">
                  {gecStats.latest_list_date ? new Date(gecStats.latest_list_date).toLocaleDateString() : 'Not loaded'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ambiguous DOBs</span>
                <span className={`font-semibold ${gecStats.ambiguous_dob_count > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {gecStats.ambiguous_dob_count || 0}
                </span>
              </div>
              {!gecStats.total_voters && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">No GEC voter data loaded. Upload the voter registration list to enable auto-vetting.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Loading...</p>
          )}
        </div>

        {/* Reports Quick Access */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Reports</h2>
            <Link to="/team/reports" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All</Link>
          </div>
          <div className="space-y-2">
            {quickStats && (
              <>
                <ReportStat label="Quota Eligible" value={quickStats.quota_eligible} />
                <ReportStat label="Total Verified" value={quickStats.total_verified} />
                <ReportStat label="Transfers/Referrals" value={quickStats.transfers} />
                <ReportStat label="Purged Voters" value={quickStats.purged_voters} />
                <ReportStat label="Unregistered" value={quickStats.unregistered} />
              </>
            )}
            <Link
              to="/team/reports"
              className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium text-blue-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Generate Excel Reports
            </Link>
          </div>
        </div>
      </div>

      {/* Village breakdown */}
      {dashboard?.villages && dashboard.villages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Village Quota Progress</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Village</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Target</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Quota Eligible</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Team Input</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Public</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Progress</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.villages.map((v: Record<string, unknown>) => {
                  const target = (v.target as number) || 0;
                  const eligible = (v.quota_eligible_count as number) || 0;
                  const pct = target > 0 ? Math.round((eligible / target) * 100) : 0;
                  return (
                    <tr key={v.village_id as number} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">{v.village_name as string}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{target}</td>
                      <td className="py-2 px-3 text-right font-semibold text-green-700">{eligible}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{(v.team_input_count as number) || 0}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{(v.public_signup_count as number) || 0}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, detail, to }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  detail: string;
  to?: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-600 border-green-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    gray: 'bg-gray-50 text-gray-600 border-gray-100',
  };

  const content = (
    <div className={`p-4 rounded-xl border ${colorMap[color]} ${to ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 opacity-70" />
        {to && <TrendingUp className="w-3.5 h-3.5 opacity-40" />}
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs font-medium opacity-70 mt-0.5">{label}</div>
      <div className="text-[10px] opacity-50 mt-0.5">{detail}</div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all text-center"
    >
      <Icon className="w-5 h-5 text-gray-500" />
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </Link>
  );
}

function ReportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{(value || 0).toLocaleString()}</span>
    </div>
  );
}
