import { useQuery } from '@tanstack/react-query';
import { getWarRoom } from '../../lib/api';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Radio, Users, TrendingUp, MapPin, Phone,
  AlertTriangle, Clock, Activity, Eye, CheckCircle, X
} from 'lucide-react';
import { useCampaignUpdates } from '../../hooks/useCampaignUpdates';
import { useRealtimeToast } from '../../hooks/useRealtimeToast';

function turnoutColor(pct: number) {
  if (pct >= 50) return 'text-green-600';
  if (pct >= 30) return 'text-yellow-600';
  return 'text-red-600';
}

function turnoutBg(pct: number) {
  if (pct >= 50) return 'bg-green-500';
  if (pct >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

function statusBadge(status: string, hasIssues: boolean) {
  if (hasIssues) return 'bg-red-100 text-red-700 border-red-300';
  if (status === 'strong') return 'bg-green-100 text-green-700 border-green-300';
  if (status === 'moderate') return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  if (status === 'low') return 'bg-red-100 text-red-700 border-red-300';
  return 'bg-gray-100 text-gray-500 border-gray-300';
}

function statusLabel(status: string, hasIssues: boolean) {
  if (hasIssues) return 'ISSUE';
  if (status === 'strong') return 'STRONG';
  if (status === 'moderate') return 'MODERATE';
  if (status === 'low') return 'LOW';
  return 'NO DATA';
}

function reportTypeIcon(type: string) {
  switch (type) {
    case 'turnout_update': return '📊';
    case 'line_length': return '🕐';
    case 'issue': return '⚠️';
    case 'closing': return '🔒';
    default: return '📋';
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export default function WarRoomPage() {
  const { toasts, handleEvent, dismiss } = useRealtimeToast();
  useCampaignUpdates(handleEvent);

  const { data, isLoading } = useQuery({
    queryKey: ['war_room'],
    queryFn: getWarRoom,
    refetchInterval: 30_000, // Fallback poll every 30s (WebSocket handles instant updates)
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400 text-lg flex items-center gap-3">
          <Radio className="w-5 h-5 animate-pulse" /> Loading War Room...
        </div>
      </div>
    );
  }

  const { villages, stats, call_priorities, activity } = data;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Real-time toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`rounded-lg p-3 pr-8 shadow-lg border text-sm animate-slide-in relative ${
                toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-100' :
                toast.type === 'warning' ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100' :
                'bg-blue-900/90 border-blue-700 text-blue-100'
              }`}
            >
              {toast.message}
              <button
                onClick={() => dismiss(toast.id)}
                className="absolute top-2 right-2 text-white/50 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <header className="bg-black/50 border-b border-gray-700 py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            <div>
              <h1 className="text-lg font-bold">WAR ROOM</h1>
              <p className="text-xs text-gray-400">Election Day Command Center</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/admin/poll-watcher" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <Eye className="w-4 h-4" /> Poll Watcher
            </Link>
            <span className="text-gray-500">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Activity className="w-3.5 h-3.5" /> ISLAND TURNOUT
            </div>
            <div className={`text-3xl font-bold ${turnoutColor(stats.island_turnout_pct)}`}>
              {stats.island_turnout_pct}%
            </div>
            <div className="text-xs text-gray-500">
              {stats.total_voted.toLocaleString()} / {stats.total_registered.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <MapPin className="w-3.5 h-3.5" /> REPORTING
            </div>
            <div className="text-3xl font-bold text-blue-400">
              {stats.reporting_precincts}/{stats.total_precincts}
            </div>
            <div className="text-xs text-gray-500">{stats.reporting_pct}% of precincts</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Users className="w-3.5 h-3.5" /> SUPPORTERS
            </div>
            <div className="text-3xl font-bold text-purple-400">
              {stats.total_supporters.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">total in database</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Clock className="w-3.5 h-3.5" /> LAST HOUR
            </div>
            <div className="text-3xl font-bold text-cyan-400">
              {stats.last_hour_reports}
            </div>
            <div className="text-xs text-gray-500">reports received</div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Village Map - 2 cols */}
          <div className="md:col-span-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Village Turnout
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {villages.map((v: any) => (
                <div
                  key={v.id}
                  className={`bg-gray-800 rounded-lg border p-3 ${
                    v.has_issues ? 'border-red-500/50' : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{v.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${statusBadge(v.status, v.has_issues)}`}>
                      {statusLabel(v.status, v.has_issues)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                    <span>{v.reporting_precincts}/{v.total_precincts} precincts</span>
                    <span className={`font-bold text-sm ${turnoutColor(v.turnout_pct)}`}>
                      {v.turnout_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${turnoutBg(v.turnout_pct)}`}
                      style={{ width: `${Math.min(v.turnout_pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{v.voters_reported.toLocaleString()} voted</span>
                    <span>{v.supporter_count} supporters</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Call Bank Priorities */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4 text-red-400" /> Call Priorities
              </h2>
              {call_priorities.length > 0 ? (
                <div className="space-y-2">
                  {call_priorities.map((v: any) => (
                    <div key={v.id} className="bg-red-900/30 border border-red-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{v.name}</span>
                        <span className="text-red-400 font-bold text-sm">{v.turnout_pct}%</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {v.supporter_count} supporters to call · {v.motorcade_count} motorcade ready
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center text-sm text-gray-500">
                  {stats.reporting_precincts === 0 ? (
                    <>No reports yet — waiting for poll watchers</>
                  ) : (
                    <><CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" /> All villages showing good turnout</>
                  )}
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Radio className="w-4 h-4 text-green-400" /> Live Activity
              </h2>
              {activity.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activity.map((a: any) => (
                    <div key={a.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {reportTypeIcon(a.report_type)} Precinct {a.precinct_number}
                        </span>
                        <span className="text-xs text-gray-500">{timeAgo(a.reported_at)}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {a.village_name} · {a.voter_count.toLocaleString()} voters
                      </div>
                      {a.notes && (
                        <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {a.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center text-sm text-gray-500">
                  Waiting for first reports...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
