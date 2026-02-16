import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDuplicates, resolveDuplicate, scanDuplicates, getVillages } from '../../lib/api';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Search, Merge, X } from 'lucide-react';

interface Supporter {
  id: number;
  first_name: string;
  last_name: string;
  print_name: string;
  contact_number: string;
  email?: string;
  village_name: string;
  village_id: number;
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

  const supporters: Supporter[] = dupData?.supporters || [];
  const totalCount: number = dupData?.total_count || 0;
  const villages: Village[] = villagesData?.villages || villagesData || [];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Duplicate Review</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {totalCount} potential duplicate{totalCount !== 1 ? 's' : ''} flagged for review
          </p>
        </div>
        <button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#15305a] disabled:opacity-50"
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
          className="rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-sm"
        >
          <option value="">All Villages</option>
          {villages.map((v: Village) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
      ) : supporters.length === 0 ? (
        <div className="app-card p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-[var(--text-primary)]">No Duplicates Found</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">All supporters look unique. Run a scan to check again.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {supporters.map((s) => (
            <div key={s.id} className="app-card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <Link
                      to={`/admin/supporters/${s.id}`}
                      className="font-medium text-[#1B3A6B] hover:underline truncate"
                    >
                      {s.first_name} {s.last_name}
                    </Link>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Potential Duplicate
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)] space-y-0.5">
                    <p>{s.contact_number} · {s.village_name} · {s.source?.replace('_', ' ')} · {formatDate(s.created_at)}</p>
                    {s.duplicate_notes && (
                      <p className="text-xs text-[var(--text-muted)]">{s.duplicate_notes}</p>
                    )}
                    {s.duplicate_of && (
                      <p className="text-xs">
                        <span className="text-[var(--text-muted)]">Possible match: </span>
                        <Link to={`/admin/supporters/${s.duplicate_of.id}`} className="text-[#1B3A6B] hover:underline">
                          {s.duplicate_of.name}
                        </Link>
                        <span className="text-[var(--text-muted)]"> ({s.duplicate_of.contact_number})</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => resolveMutation.mutate({ id: s.id, resolution: 'dismiss' })}
                    disabled={resolveMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--border-soft)] rounded-lg hover:bg-[var(--surface-bg)] text-[var(--text-primary)]"
                    title="Not a duplicate"
                  >
                    <X className="w-3.5 h-3.5" />
                    Dismiss
                  </button>
                  {s.duplicate_of_id && (
                    <button
                      onClick={() => {
                        if (confirm(`Merge "${s.first_name} ${s.last_name}" into the original record? This will mark this record as duplicate.`)) {
                          resolveMutation.mutate({ id: s.id, resolution: 'merge', mergeIntoId: s.duplicate_of_id! });
                        }
                      }}
                      disabled={resolveMutation.isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-[#C41E3A] text-white rounded-lg hover:bg-[#a3182f]"
                      title="Merge into original"
                    >
                      <Merge className="w-3.5 h-3.5" />
                      Merge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
