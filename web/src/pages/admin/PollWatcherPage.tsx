import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPollWatcher, submitPollReport } from '../../lib/api';
import { useCampaignUpdates } from '../../hooks/useCampaignUpdates';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Send, CheckCircle, Clock, AlertTriangle, MapPin } from 'lucide-react';

const REPORT_TYPES = [
  { value: 'turnout_update', label: 'Turnout Update', icon: '📊' },
  { value: 'line_length', label: 'Long Lines', icon: '🕐' },
  { value: 'issue', label: 'Report Issue', icon: '⚠️' },
  { value: 'closing', label: 'Polls Closing', icon: '🔒' },
];

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

export default function PollWatcherPage() {
  useCampaignUpdates(); // Auto-invalidates on real-time events
  const queryClient = useQueryClient();
  const [selectedPrecinct, setSelectedPrecinct] = useState<any>(null);
  const [voterCount, setVoterCount] = useState('');
  const [reportType, setReportType] = useState('turnout_update');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterVillage, setFilterVillage] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['poll_watcher'],
    queryFn: getPollWatcher,
    refetchInterval: 15_000, // Refresh every 15s on election day
  });

  const mutation = useMutation({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrecinct || !voterCount) return;
    mutation.mutate({
      precinct_id: selectedPrecinct.id,
      voter_count: parseInt(voterCount),
      report_type: reportType,
      notes: notes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg">Loading precincts...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <AlertTriangle className="w-12 h-12 text-[#1B3A6B] mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Can't connect to server</h2>
          <p className="text-gray-500 mb-4">Check your connection and try again.</p>
          <button onClick={() => window.location.reload()} className="bg-[#1B3A6B] text-white px-4 py-2 rounded-lg hover:bg-[#152e55]">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { villages, stats } = data;
  const filteredVillages = filterVillage
    ? villages.filter((v: any) => v.id === parseInt(filterVillage))
    : villages;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1B3A6B] text-white py-3 px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-blue-200" />
            <div>
              <h1 className="text-lg font-bold">Poll Watcher</h1>
              <p className="text-blue-200 text-xs">Election Day Real-Time Reporting</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Success Message */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-3 border text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.reporting_precincts}/{stats.total_precincts}</div>
            <div className="text-xs text-gray-500">Reporting</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 border text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total_voters_reported.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Voters Counted</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 border text-center">
            <div className={`text-2xl font-bold ${turnoutColor(stats.overall_turnout_pct)}`}>
              {stats.overall_turnout_pct || 0}%
            </div>
            <div className="text-xs text-gray-500">Turnout</div>
          </div>
        </div>

        {/* Report Form */}
        {selectedPrecinct ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 mb-4">
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

            {/* Report Type */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => setReportType(rt.value)}
                  className={`p-2 rounded-lg border text-sm font-medium text-left flex items-center gap-2 ${
                    reportType === rt.value
                      ? 'border-[#1B3A6B] bg-blue-50 text-[#1B3A6B]'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{rt.icon}</span> {rt.label}
                </button>
              ))}
            </div>

            {/* Voter Count */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Voters who have voted so far
              </label>
              <input
                type="number"
                value={voterCount}
                onChange={e => setVoterCount(e.target.value)}
                placeholder="Enter count"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B]"
                min="0"
                autoFocus
                required
              />
            </div>

            {/* Notes */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any issues, observations..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B3A6B]"
                rows={2}
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending || !voterCount}
              className="w-full bg-[#1B3A6B] hover:bg-[#152e55] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {mutation.isPending ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            Tap a precinct below to submit a report
          </div>
        )}

        {/* Village Filter */}
        <select
          value={filterVillage}
          onChange={e => setFilterVillage(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
        >
          <option value="">All Villages ({stats.total_precincts} precincts)</option>
          {villages.map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.reporting_count}/{v.total_precincts} reporting)
            </option>
          ))}
        </select>

        {/* Precinct List */}
        {filteredVillages.map((village: any) => (
          <div key={village.id} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700">{village.name}</h3>
              <span className="text-xs text-gray-400">
                {village.reporting_count}/{village.total_precincts} reporting
              </span>
            </div>
            <div className="space-y-2">
              {village.precincts.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPrecinct(p)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
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
      </div>
    </div>
  );
}
