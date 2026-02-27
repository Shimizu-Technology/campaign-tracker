import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVettingQueue, getVillages, verifySupporter, bulkVerifySupporters } from '../../lib/api';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  ShieldCheck,
  MapPin,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

type VettingFilter = 'all' | 'flagged' | 'unverified' | 'unregistered' | 'referral';

export default function TeamVettingPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<VettingFilter>('all');
  const [villageId, setVillageId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: villages } = useQuery({ queryKey: ['villages'], queryFn: getVillages });
  const { data, isLoading } = useQuery({
    queryKey: ['vetting-queue', filter, villageId, search, page],
    queryFn: () => getVettingQueue({
      filter: filter === 'all' ? undefined : filter,
      village_id: villageId || undefined,
      search: search || undefined,
      page,
      per_page: 50,
    }),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => verifySupporter(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vetting-queue'] }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: string }) => bulkVerifySupporters(ids, status),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['vetting-queue'] });
    },
  });

  const supporters = data?.supporters || [];
  const summary = data?.summary || {};
  const pagination = data?.pagination || {};

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === supporters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(supporters.map((s: Record<string, unknown>) => s.id as number)));
    }
  };

  const confidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'exact': return 'text-green-700 bg-green-50';
      case 'high': return 'text-blue-700 bg-blue-50';
      case 'medium': return 'text-amber-700 bg-amber-50';
      case 'low': return 'text-red-700 bg-red-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  const matchTypeLabel = (type: string) => {
    switch (type) {
      // Legacy (full DOB) match types
      case 'exact_match':
      case 'exact_dob_village':   return 'Exact (DOB + Village)';
      case 'different_village':   return 'Different Village';
      case 'fuzzy_name':          return 'Fuzzy Name';
      case 'name_dob_only':       return 'Name + DOB';
      case 'name_village_only':   return 'Name + Village';
      // New (birth-year-only) match types
      case 'name_year_village':   return 'Name + Year + Village';
      case 'name_year_diff_village': return 'Diff. Village (Year)';
      case 'name_year_only':      return 'Name + Year';
      case 'name_only':           return 'Name Only';
      default: return type.replace(/_/g, ' ');
    }
  };

  const confidenceLabel = (confidence: string, matchCount?: number) => {
    const count = matchCount && matchCount > 1 ? ` (${matchCount} candidates)` : '';
    switch (confidence) {
      case 'exact':  return `Exact${count}`;
      case 'high':   return `High${count}`;
      case 'medium': return `Medium${count}`;
      case 'low':    return `Low${count}`;
      default:       return confidence;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Vetting Queue</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review and verify supporter registrations against GEC voter rolls</p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <FilterBadge active={filter === 'all'} onClick={() => { setFilter('all'); setPage(1); }}
          label="All" count={summary.total_needing_review} />
        <FilterBadge active={filter === 'flagged'} onClick={() => { setFilter('flagged'); setPage(1); }}
          label="Flagged" count={summary.flagged} color="amber" />
        <FilterBadge active={filter === 'unverified'} onClick={() => { setFilter('unverified'); setPage(1); }}
          label="Unverified" count={summary.unverified} color="blue" />
        <FilterBadge active={filter === 'unregistered'} onClick={() => { setFilter('unregistered'); setPage(1); }}
          label="Unregistered" count={summary.unregistered} color="red" />
        <FilterBadge active={filter === 'referral'} onClick={() => { setFilter('referral'); setPage(1); }}
          label="Referrals" count={summary.referrals} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={villageId}
          onChange={e => { setVillageId(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Villages</option>
          {(villages || []).map((v: Record<string, unknown>) => (
            <option key={v.id as number} value={v.id as number}>{v.name as string}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), status: 'verified' })}
            disabled={bulkMutation.isPending}
            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Verify All
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />)}
        </div>
      ) : supporters.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">All caught up!</h3>
          <p className="text-sm text-gray-400 mt-1">No supporters need vetting review right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select all */}
          <div className="flex items-center gap-2 px-3 py-1">
            <input type="checkbox" checked={selectedIds.size === supporters.length && supporters.length > 0}
              onChange={toggleAll} className="rounded border-gray-300" />
            <span className="text-xs text-gray-400">Select all on page</span>
          </div>

          {supporters.map((s: Record<string, unknown>) => {
            const id = s.id as number;
            const expanded = expandedId === id;
            const matches = (s.gec_matches || []) as Array<Record<string, unknown>>;
            const statusColor = s.verification_status === 'flagged' ? 'text-amber-600' :
              s.verification_status === 'unverified' ? 'text-blue-600' : 'text-gray-600';

            return (
              <div key={id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleSelect(id)}
                    className="rounded border-gray-300 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/supporters/${id}`} className="font-medium text-gray-900 hover:text-blue-600 text-sm">
                        {s.last_name as string}, {s.first_name as string}
                      </Link>
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusColor} bg-opacity-10`}>
                        {(s.verification_status as string)?.replace(/_/g, ' ')}
                      </span>
                      {s.referred_from_village_id && (
                        <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" /> Referral
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {s.village_name as string} &middot; {s.contact_number as string || 'No phone'}
                      {s.dob
                        ? <> &middot; DOB: {new Date(s.dob as string).toLocaleDateString()}</>
                        : s.birth_year
                          ? <> &middot; Born: {s.birth_year as number}</>
                          : null
                      }
                    </div>
                    {matches.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {matches.slice(0, 3).map((m, i) => {
                          const gv = m.gec_voter as Record<string, unknown>;
                          const mc = m.match_count as number | undefined;
                          return (
                            <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${confidenceColor(m.confidence as string)}`}>
                              {confidenceLabel(m.confidence as string, mc)} &middot; {matchTypeLabel(m.match_type as string)}
                              {(m.match_type === 'different_village' || m.match_type === 'name_year_diff_village') && ` — ${gv.village_name as string}`}
                            </span>
                          );
                        })}
                        {matches.length > 3 && (
                          <span className="text-[10px] text-gray-400 px-2 py-0.5">+{matches.length - 3} more</span>
                        )}
                      </div>
                    )}
                    {matches.length === 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <XCircle className="w-3 h-3 text-red-400" />
                        <span className="text-[10px] text-red-500 font-medium">No GEC match found</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => verifyMutation.mutate({ id, status: 'verified' })}
                      disabled={verifyMutation.isPending}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Verify"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => verifyMutation.mutate({ id, status: 'rejected' })}
                      disabled={verifyMutation.isPending}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Reject"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setExpandedId(expanded ? null : id)}
                      className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs">
                      <div><span className="text-gray-400">Source:</span> <span className="font-medium text-gray-700">{(s.source as string)?.replace(/_/g, ' ')}</span></div>
                      <div><span className="text-gray-400">Registered:</span> <span className="font-medium text-gray-700">{s.registered_voter ? 'Yes' : 'No'}</span></div>
                      <div><span className="text-gray-400">Created:</span> <span className="font-medium text-gray-700">{new Date(s.created_at as string).toLocaleDateString()}</span></div>
                      <div><span className="text-gray-400">Email:</span> <span className="font-medium text-gray-700">{(s.email as string) || 'N/A'}</span></div>
                    </div>
                    {matches.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase mb-2">GEC Match Details</div>
                        {matches.map((m, i) => {
                          const gv = m.gec_voter as Record<string, unknown>;
                          return (
                            <div key={i} className="p-2 bg-white rounded-lg border border-gray-100 mb-1 text-xs flex justify-between items-start gap-2">
                              <div>
                                <span className="font-medium">{gv.first_name as string} {gv.last_name as string}</span>
                                <span className="text-gray-400 ml-2">{gv.village_name as string}</span>
                                {gv.dob && <span className="text-gray-400 ml-2">DOB: {new Date(gv.dob as string).toLocaleDateString()}</span>}
                                {!gv.dob && gv.birth_year && <span className="text-gray-400 ml-2">Born: {gv.birth_year as number}</span>}
                                {gv.voter_registration_number && <span className="text-gray-400 ml-2">Reg: {gv.voter_registration_number as string}</span>}
                                <div className="text-gray-400 mt-0.5">{matchTypeLabel(m.match_type as string)}</div>
                                {(m.match_count as number) > 1 && (
                                  <div className="text-amber-600 mt-0.5">
                                    {m.match_count as number} candidates matched — manual review recommended
                                  </div>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 rounded-full font-semibold shrink-0 ${confidenceColor(m.confidence as string)}`}>
                                {confidenceLabel(m.confidence as string, m.match_count as number)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {pagination.pages}</span>
          <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}
    </div>
  );
}

function FilterBadge({ active, onClick, label, count }: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  color?: string;
}) {
  const base = active
    ? 'bg-gray-900 text-white border-gray-900'
    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300';
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${base}`}>
      {label}
      {count !== undefined && <span className="ml-1.5 opacity-70">{count}</span>}
    </button>
  );
}
