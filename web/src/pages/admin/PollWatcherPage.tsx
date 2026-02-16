import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createStrikeListContactAttempt, getPollWatcher, getPollWatcherStrikeList, submitPollReport, updateStrikeListTurnout } from '../../lib/api';
import { useCampaignUpdates } from '../../hooks/useCampaignUpdates';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, Send, CheckCircle, Clock, AlertTriangle, MapPin, BarChart3, Timer, Lock, Search, PhoneCall, UserCheck } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface PrecinctItem {
  id: number;
  number: string;
  polling_site?: string;
  registered_voters?: number;
  alpha_range?: string;
  reporting: boolean;
  turnout_pct: number | null;
  last_voter_count?: number;
  last_notes?: string;
}

interface VillageItem {
  id: number;
  name: string;
  reporting_count: number;
  total_precincts: number;
  precincts: PrecinctItem[];
}

interface PollWatcherStats {
  reporting_precincts: number;
  total_precincts: number;
  total_voters_reported: number;
  overall_turnout_pct: number;
}

interface PollWatcherData {
  villages: VillageItem[];
  stats: PollWatcherStats;
}

interface StrikeListSupporter {
  id: number;
  print_name: string;
  contact_number: string;
  turnout_status: 'unknown' | 'not_yet_voted' | 'voted';
  turnout_note?: string;
  turnout_updated_at?: string;
  latest_contact_attempt?: {
    outcome: string;
    channel: string;
    recorded_at: string;
  };
}

interface StrikeListData {
  compliance_note?: string;
  supporters: StrikeListSupporter[];
}

type PollWatcherSortField = 'precinct_number' | 'turnout_pct' | 'last_voter_count';

const REPORT_TYPES = [
  { value: 'turnout_update', label: 'Turnout Update', icon: BarChart3 },
  { value: 'line_length', label: 'Long Lines', icon: Timer },
  { value: 'issue', label: 'Report Issue', icon: AlertTriangle },
  { value: 'closing', label: 'Polls Closing', icon: Lock },
];

const TURNOUT_OPTIONS = [
  { value: 'not_yet_voted', label: 'Not Yet Voted' },
  { value: 'voted', label: 'Voted' },
] as const;

function turnoutColor(pct: number | null) {
  if (pct === null) return 'text-gray-400';
  if (pct >= 60) return 'text-green-600';
  if (pct >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function turnoutBg(pct: number | null) {
  if (pct === null) return 'bg-gray-100';
  if (pct >= 60) return 'bg-green-500';
  if (pct >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function turnoutStatusBadgeClasses(status: StrikeListSupporter['turnout_status']) {
  if (status === 'voted') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'not_yet_voted') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

export default function PollWatcherPage() {
  useCampaignUpdates(); // Auto-invalidates on real-time events
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPrecinct, setSelectedPrecinct] = useState<PrecinctItem | null>(null);
  const [voterCount, setVoterCount] = useState('');
  const [reportType, setReportType] = useState('turnout_update');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterVillage, setFilterVillage] = useState(searchParams.get('village_id') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [reportingFilter, setReportingFilter] = useState(searchParams.get('reporting') || '');
  const [sortBy, setSortBy] = useState<PollWatcherSortField>((searchParams.get('sort_by') as PollWatcherSortField) || 'precinct_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((searchParams.get('sort_dir') as 'asc' | 'desc') || 'asc');
  const [strikeSearch, setStrikeSearch] = useState('');
  const [strikeStatusFilter, setStrikeStatusFilter] = useState<'not_yet_voted' | 'voted' | 'unknown' | ''>('not_yet_voted');
  const [strikeNotice, setStrikeNotice] = useState('');
  const [turnoutNoteBySupporter, setTurnoutNoteBySupporter] = useState<Record<number, string>>({});
  const debouncedStrikeSearch = useDebouncedValue(strikeSearch, 250);

  const { data, isLoading, isError } = useQuery<PollWatcherData>({
    queryKey: ['poll_watcher'],
    queryFn: getPollWatcher,
    refetchInterval: 15_000, // Refresh every 15s on election day
  });

  const reportMutation = useMutation({
    mutationFn: submitPollReport,
    onSuccess: (data) => {
      setSuccessMsg(data.message);
      setVoterCount('');
      setNotes('');
      setSelectedPrecinct(null);
      queryClient.invalidateQueries({ queryKey: ['poll_watcher'] });
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  const { data: strikeListData, isLoading: strikeListLoading } = useQuery<StrikeListData>({
    queryKey: ['poll_watcher_strike_list', selectedPrecinct?.id, strikeStatusFilter, debouncedStrikeSearch],
    queryFn: () => getPollWatcherStrikeList({
      precinct_id: selectedPrecinct?.id,
      turnout_status: strikeStatusFilter || undefined,
      search: debouncedStrikeSearch || undefined,
    }),
    enabled: Boolean(selectedPrecinct?.id),
  });

  const turnoutMutation = useMutation({
    mutationFn: ({ supporterId, turnoutStatus }: { supporterId: number; turnoutStatus: 'not_yet_voted' | 'voted' }) => {
      if (!selectedPrecinct) throw new Error('No precinct selected');
      return updateStrikeListTurnout(supporterId, {
        precinct_id: selectedPrecinct.id,
        turnout_status: turnoutStatus,
        note: turnoutNoteBySupporter[supporterId] || undefined,
      });
    },
    onSuccess: (response: { message?: string }) => {
      setStrikeNotice(response?.message || 'Turnout updated');
      queryClient.invalidateQueries({ queryKey: ['poll_watcher'] });
      queryClient.invalidateQueries({ queryKey: ['poll_watcher_strike_list'] });
      setTimeout(() => setStrikeNotice(''), 3000);
    },
  });

  const contactAttemptMutation = useMutation({
    mutationFn: ({ supporterId, outcome }: { supporterId: number; outcome: 'attempted' | 'reached' }) => {
      if (!selectedPrecinct) throw new Error('No precinct selected');
      return createStrikeListContactAttempt(supporterId, {
        precinct_id: selectedPrecinct.id,
        outcome,
        channel: 'call',
        note: turnoutNoteBySupporter[supporterId] || undefined,
      });
    },
    onSuccess: (response: { message?: string }) => {
      setStrikeNotice(response?.message || 'Contact attempt logged');
      queryClient.invalidateQueries({ queryKey: ['poll_watcher_strike_list'] });
      setTimeout(() => setStrikeNotice(''), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrecinct || !voterCount) return;
    reportMutation.mutate({
      precinct_id: selectedPrecinct.id,
      voter_count: parseInt(voterCount),
      report_type: reportType,
      notes: notes || undefined,
    });
  };

  const handleSelectPrecinct = (precinct: PrecinctItem) => {
    setSelectedPrecinct(precinct);
    setStrikeSearch('');
    setStrikeStatusFilter('not_yet_voted');
    setTurnoutNoteBySupporter({});
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterVillage) params.set('village_id', filterVillage);
    if (search) params.set('search', search);
    if (reportingFilter) params.set('reporting', reportingFilter);
    params.set('sort_by', sortBy);
    params.set('sort_dir', sortDir);
    setSearchParams(params, { replace: true });
  }, [filterVillage, search, reportingFilter, sortBy, sortDir, setSearchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-blue-300/60 text-sm font-medium">Loading precincts...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center p-8">
          <AlertTriangle className="w-12 h-12 text-blue-400/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Can&apos;t connect to server</h2>
          <p className="text-blue-200/50 mb-4">Check your connection and try again.</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { villages, stats } = data;
  const filteredVillages = (filterVillage
    ? villages.filter((v) => v.id === parseInt(filterVillage))
    : villages
  ).map((village) => {
    const q = search.trim().toLowerCase();
    const filteredPrecincts = village.precincts.filter((precinct) => {
      const searchHit = q.length === 0 ||
        precinct.number.toLowerCase().includes(q) ||
        (precinct.polling_site || '').toLowerCase().includes(q) ||
        (precinct.alpha_range || '').toLowerCase().includes(q);
      const reportingHit = reportingFilter === ''
        ? true
        : reportingFilter === 'reporting'
          ? precinct.reporting
          : !precinct.reporting;
      return searchHit && reportingHit;
    });

    const sortedPrecincts = [...filteredPrecincts].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'turnout_pct') return ((a.turnout_pct || 0) - (b.turnout_pct || 0)) * dir;
      if (sortBy === 'last_voter_count') return ((a.last_voter_count || 0) - (b.last_voter_count || 0)) * dir;
      return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });

    return {
      ...village,
      precincts: sortedPrecincts,
    };
  }).filter((village) => village.precincts.length > 0);

  const visiblePrecinctCount = filteredVillages.reduce((sum, village) => sum + village.precincts.length, 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1B3A6B] text-white py-3 px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-blue-200" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Poll Watcher</h1>
              <p className="text-blue-200 text-xs">Election Day Real-Time Reporting</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Success Message */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl p-3 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="app-card p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.reporting_precincts}/{stats.total_precincts}</div>
            <div className="text-xs text-gray-500">Reporting</div>
          </div>
          <div className="app-card p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total_voters_reported.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Voters Counted</div>
          </div>
          <div className="app-card p-3 text-center">
            <div className={`text-2xl font-bold ${turnoutColor(stats.overall_turnout_pct)}`}>
              {stats.overall_turnout_pct || 0}%
            </div>
            <div className="text-xs text-gray-500">Turnout</div>
          </div>
        </div>

        {/* Report + Strike List */}
        {selectedPrecinct ? (
          <div className="space-y-4 mb-4">
            <form onSubmit={handleSubmit} className="app-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">Precinct {selectedPrecinct.number}</h3>
                  <p className="text-sm text-gray-500">{selectedPrecinct.polling_site || 'No polling site listed'}</p>
                  <p className="text-xs text-gray-400">{selectedPrecinct.registered_voters?.toLocaleString()} registered voters</p>
                </div>
                <button type="button" onClick={() => setSelectedPrecinct(null)} className="text-gray-400 hover:text-gray-600 text-sm">
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {REPORT_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReportType(value)}
                    className={`p-2 min-h-[44px] rounded-xl border text-sm font-medium text-left flex items-center gap-2 ${
                      reportType === value
                        ? 'border-[#1B3A6B] bg-blue-50 text-[#1B3A6B]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voters who have voted so far
                </label>
                <input
                  type="number"
                  value={voterCount}
                  onChange={e => setVoterCount(e.target.value)}
                  placeholder="Enter count"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-[#1B3A6B]"
                  min="0"
                  autoFocus
                  required
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any issues, observations..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1B3A6B]"
                  rows={2}
                />
              </div>

              <button
                type="submit"
                disabled={reportMutation.isPending || !voterCount}
                className="w-full bg-[#1B3A6B] hover:bg-[#152e55] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>

            <div className="app-card p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="font-bold text-gray-900">Supporter Strike List</h3>
                <span className="text-xs text-gray-500">
                  {strikeListData?.supporters.length || 0} supporters
                </span>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-3">
                {strikeListData?.compliance_note || 'Campaign operations tracking only; not official election records.'}
              </p>
              {strikeNotice && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2 mb-3">
                  {strikeNotice}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <input
                  type="text"
                  value={strikeSearch}
                  onChange={(e) => setStrikeSearch(e.target.value)}
                  placeholder="Search supporter name/phone..."
                  className="md:col-span-2 w-full px-3 py-2 border border-gray-300 rounded-xl text-sm min-h-[44px]"
                />
                <select
                  value={strikeStatusFilter}
                  onChange={(e) => setStrikeStatusFilter(e.target.value as 'not_yet_voted' | 'voted' | 'unknown' | '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white min-h-[44px]"
                >
                  <option value="">All turnout states</option>
                  <option value="not_yet_voted">Not yet voted</option>
                  <option value="voted">Voted</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              {strikeListLoading ? (
                <div className="text-sm text-gray-500 py-4">Loading strike list...</div>
              ) : (
                <div className="space-y-2">
                  {(strikeListData?.supporters || []).map((supporter) => (
                    <div key={supporter.id} className="border border-gray-200 rounded-xl p-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900">{supporter.print_name}</p>
                          <p className="text-xs text-gray-500">{supporter.contact_number}</p>
                        </div>
                        <span className={`text-xs border rounded-full px-2 py-1 ${turnoutStatusBadgeClasses(supporter.turnout_status)}`}>
                          {supporter.turnout_status.replaceAll('_', ' ')}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {TURNOUT_OPTIONS.map((option) => (
                          <button
                            key={`${supporter.id}-${option.value}`}
                            type="button"
                            onClick={() => turnoutMutation.mutate({ supporterId: supporter.id, turnoutStatus: option.value })}
                            className={`min-h-[44px] rounded-xl border text-xs font-semibold ${
                              supporter.turnout_status === option.value
                                ? 'border-[#1B3A6B] bg-blue-50 text-[#1B3A6B]'
                                : 'border-gray-200 text-gray-600'
                            }`}
                            disabled={turnoutMutation.isPending}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => contactAttemptMutation.mutate({ supporterId: supporter.id, outcome: 'attempted' })}
                          className="min-h-[44px] rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 flex items-center justify-center gap-1"
                          disabled={contactAttemptMutation.isPending}
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> Call Attempted
                        </button>
                        <button
                          type="button"
                          onClick={() => contactAttemptMutation.mutate({ supporterId: supporter.id, outcome: 'reached' })}
                          className="min-h-[44px] rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 flex items-center justify-center gap-1"
                          disabled={contactAttemptMutation.isPending}
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Reached
                        </button>
                      </div>

                      <input
                        type="text"
                        value={turnoutNoteBySupporter[supporter.id] || ''}
                        onChange={(e) => setTurnoutNoteBySupporter((prev) => ({ ...prev, [supporter.id]: e.target.value }))}
                        placeholder="Optional note for turnout/contact update"
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-xl text-xs min-h-[44px]"
                      />

                      {supporter.latest_contact_attempt && (
                        <p className="text-[11px] text-gray-500 mt-1.5">
                          Last contact: {supporter.latest_contact_attempt.outcome} via {supporter.latest_contact_attempt.channel}
                        </p>
                      )}
                    </div>
                  ))}
                  {!strikeListLoading && (strikeListData?.supporters || []).length === 0 && (
                    <div className="text-sm text-gray-400 py-4">No supporters match current strike-list filters.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-sm text-blue-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0" />
            Tap a precinct below to submit a report
          </div>
        )}

        <div className="app-card p-3 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search precinct #, site, alpha..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm min-h-[44px]"
            />
          </div>
          <select
            value={filterVillage}
            onChange={e => setFilterVillage(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white min-h-[44px]"
          >
            <option value="">All Villages ({stats.total_precincts} precincts)</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.reporting_count}/{v.total_precincts} reporting)
              </option>
            ))}
          </select>
          <select
            value={reportingFilter}
            onChange={(e) => setReportingFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white min-h-[44px]"
          >
            <option value="">All statuses</option>
            <option value="reporting">Reporting only</option>
            <option value="not_reporting">Not reporting</option>
          </select>
          <select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(':') as [PollWatcherSortField, 'asc' | 'desc'];
              setSortBy(field);
              setSortDir(dir);
            }}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white min-h-[44px]"
          >
            <option value="precinct_number:asc">Precinct number A-Z</option>
            <option value="precinct_number:desc">Precinct number Z-A</option>
            <option value="turnout_pct:desc">Highest turnout</option>
            <option value="turnout_pct:asc">Lowest turnout</option>
            <option value="last_voter_count:desc">Most voters counted</option>
            <option value="last_voter_count:asc">Least voters counted</option>
          </select>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Showing {visiblePrecinctCount} of {stats.total_precincts} precincts
        </p>

        {/* Precinct List */}
        {filteredVillages.map((village) => (
          <div key={village.id} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700">{village.name}</h3>
              <span className="text-xs text-gray-400">
                {village.reporting_count}/{village.total_precincts} reporting
              </span>
            </div>
            <div className="space-y-2">
              {village.precincts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPrecinct(p)}
                  className={`w-full text-left rounded-xl border p-3 min-h-[44px] transition-all ${
                    selectedPrecinct?.id === p.id
                      ? 'border-[#1B3A6B] bg-blue-50 ring-2 ring-[#1B3A6B]/20'
                      : p.reporting
                        ? 'border-green-200 bg-green-50 hover:shadow-sm'
                        : 'border-gray-200 bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {p.reporting ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-300" />
                      )}
                      <span className="font-medium text-gray-900">Precinct {p.number}</span>
                      {p.alpha_range && (
                        <span className="text-xs text-gray-400">({p.alpha_range})</span>
                      )}
                    </div>
                    {p.reporting ? (
                      <div className="text-right">
                        <span className={`font-bold ${turnoutColor(p.turnout_pct)}`}>
                          {p.turnout_pct}%
                        </span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({p.last_voter_count?.toLocaleString()})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No report</span>
                    )}
                  </div>
                  {p.reporting && (
                    <div className="mt-1.5">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${turnoutBg(p.turnout_pct)}`}
                          style={{ width: `${Math.min(p.turnout_pct || 0, 100)}%` }}
                        />
                      </div>
                      {p.last_notes && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {p.last_notes}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
        {filteredVillages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            No precincts match current filters.
          </div>
        )}
      </div>
    </div>
  );
}
