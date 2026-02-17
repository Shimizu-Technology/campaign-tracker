import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDuplicates, resolveDuplicate, scanDuplicates, getVillages } from '../../lib/api';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Search, ArrowRight, X } from 'lucide-react';

interface Supporter {
  id: number;
  first_name: string;
  last_name: string;
  print_name: string;
  contact_number: string;
  email?: string;
  village_name: string;
  village_id: number;
  precinct_number?: string;
  potential_duplicate: boolean;
  duplicate_of_id?: number;
  duplicate_notes?: string;
  duplicate_of?: { id: number; name: string; contact_number: string };
  source: string;
  created_at: string;
  verification_status: string;
}

interface Village {
  id: number;
  name: string;
}

interface DuplicateGroup {
  key: string;
  supporter: Supporter;
  match: Supporter | { id: number; name: string; contact_number: string } | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function sourceLabel(source: string) {
  return source?.replace(/_/g, ' ') || 'Unknown';
}

function verificationBadge(status: string) {
  if (status === 'verified') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Verified</span>;
  if (status === 'flagged') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Flagged</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Unverified</span>;
}

function SupporterCard({ supporter, isFullRecord }: { supporter: Supporter | { id: number; name: string; contact_number: string }; isFullRecord: boolean }) {
  if (!isFullRecord) {
    const s = supporter as { id: number; name: string; contact_number: string };
    return (
      <div className="flex-1 min-w-0 p-4 bg-[var(--surface-bg)] rounded-xl">
        <Link to={`/admin/supporters/${s.id}`} className="font-medium text-[#1B3A6B] hover:underline">
          {s.name}
        </Link>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{s.contact_number}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Limited info — view full record</p>
      </div>
    );
  }

  const s = supporter as Supporter;
  return (
    <div className="flex-1 min-w-0 p-4 bg-[var(--surface-bg)] rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <Link to={`/admin/supporters/${s.id}`} className="font-semibold text-[#1B3A6B] hover:underline">
          {s.first_name} {s.last_name}
        </Link>
        {verificationBadge(s.verification_status)}
      </div>
      <div className="space-y-1 text-sm text-[var(--text-secondary)]">
        <p>{s.contact_number || 'No phone'}</p>
        {s.email && <p>{s.email}</p>}
        <p>{s.village_name}{s.precinct_number ? ` · Precinct ${s.precinct_number}` : ''}</p>
        <p className="text-xs text-[var(--text-muted)]">{sourceLabel(s.source)} · {formatDate(s.created_at)}</p>
      </div>
    </div>
  );
}

export default function DuplicatesPage() {
  const [villageFilter, setVillageFilter] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: dupData, isLoading } = useQuery({
    queryKey: ['duplicates', villageFilter],
    queryFn: () => getDuplicates(villageFilter ? Number(villageFilter) : undefined),
  });

  const { data: villagesData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });

  const scanMutation = useMutation({
    mutationFn: scanDuplicates,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      alert(`Scan complete: ${data.flagged_count} new duplicates found`);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution, mergeIntoId }: { id: number; resolution: string; mergeIntoId?: number }) =>
      resolveDuplicate(id, resolution, mergeIntoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    },
  });

  const supporters: Supporter[] = useMemo(() => dupData?.supporters || [], [dupData?.supporters]);
  const totalCount: number = dupData?.total_count || 0;
  const villages: Village[] = villagesData?.villages || villagesData || [];

  // Group duplicates into pairs
  const groups: DuplicateGroup[] = useMemo(() => {
    const seen = new Set<string>();
    const result: DuplicateGroup[] = [];

    // Build a lookup map for full supporter records
    const supporterMap = new Map<number, Supporter>();
    for (const s of supporters) {
      supporterMap.set(s.id, s);
    }

    for (const s of supporters) {
      const matchId = s.duplicate_of_id;
      // Create a stable key so we don't show the same pair twice
      const pairKey = matchId
        ? [Math.min(s.id, matchId), Math.max(s.id, matchId)].join('-')
        : `solo-${s.id}`;

      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      // Try to find the full match record; fall back to the embedded reference
      const fullMatch = matchId ? supporterMap.get(matchId) : null;
      const match = fullMatch || s.duplicate_of || null;

      result.push({ key: pairKey, supporter: s, match });
    }

    return result;
  }, [supporters]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Duplicate Review</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {groups.length} potential duplicate group{groups.length !== 1 ? 's' : ''} ({totalCount} records flagged)
          </p>
        </div>
        <button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3A6B] text-white rounded-xl min-h-[44px] hover:bg-[#15305a] disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {scanMutation.isPending ? 'Scanning...' : 'Scan for Duplicates'}
        </button>
      </div>

      {/* Filter */}
      <div className="app-card p-4">
        <label className="text-sm font-medium text-[var(--text-primary)] mr-2">Filter by Village:</label>
        <select
          value={villageFilter}
          onChange={(e) => setVillageFilter(e.target.value)}
          className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">All Villages</option>
          {villages.map((v: Village) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Groups */}
      {isLoading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="app-card p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-[var(--text-primary)]">No Duplicates Found</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">All supporters look unique. Run a scan to check again.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const s = group.supporter;
            const match = group.match;
            const matchIsFullRecord = match ? 'first_name' in match : false;

            return (
              <div key={group.key} className="app-card overflow-hidden">
                {/* Match reason header */}
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-800">Potential Duplicate</span>
                  {s.duplicate_notes && (
                    <span className="text-xs text-amber-600 ml-2">Matches: {s.duplicate_notes}</span>
                  )}
                </div>

                {/* Side-by-side comparison */}
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-start">
                    <SupporterCard supporter={s} isFullRecord={true} />

                    <div className="hidden md:flex items-center justify-center px-2">
                      <ArrowRight className="w-5 h-5 text-[var(--text-muted)] rotate-0" />
                    </div>
                    <div className="md:hidden flex items-center justify-center">
                      <span className="text-xs text-[var(--text-muted)]">matches with</span>
                    </div>

                    {match ? (
                      <SupporterCard supporter={match} isFullRecord={matchIsFullRecord} />
                    ) : (
                      <div className="flex-1 min-w-0 p-4 bg-[var(--surface-bg)] rounded-xl text-center text-sm text-[var(--text-muted)]">
                        Match record not found
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[var(--border-soft)]">
                    <button
                      onClick={() => resolveMutation.mutate({ id: s.id, resolution: 'dismiss' })}
                      disabled={resolveMutation.isPending}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-[var(--border-soft)] rounded-xl min-h-[44px] hover:bg-[var(--surface-bg)] text-[var(--text-primary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                      Not a Duplicate
                    </button>
                    {s.duplicate_of_id && match && (
                      <>
                        <button
                          onClick={() => {
                            if (!confirm(`Keep "${s.first_name} ${s.last_name}" and merge the other record into it?`)) return;
                            resolveMutation.mutate({ id: match && 'first_name' in match ? match.id : s.duplicate_of_id!, resolution: 'merge', mergeIntoId: s.id });
                          }}
                          disabled={resolveMutation.isPending}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-[#1B3A6B] text-white rounded-xl min-h-[44px] hover:bg-[#15305a]"
                        >
                          Keep Left
                        </button>
                        <button
                          onClick={() => {
                            if (!confirm(`Keep the matched record and merge "${s.first_name} ${s.last_name}" into it?`)) return;
                            resolveMutation.mutate({ id: s.id, resolution: 'merge', mergeIntoId: s.duplicate_of_id! });
                          }}
                          disabled={resolveMutation.isPending}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-[#C41E3A] text-white rounded-xl min-h-[44px] hover:bg-[#a3182f]"
                        >
                          Keep Right
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
