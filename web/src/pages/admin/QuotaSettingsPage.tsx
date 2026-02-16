import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Search, Target } from 'lucide-react';
import { getQuotas, updateVillage, updateVillageQuota } from '../../lib/api';

interface QuotaItem {
  village_id: number;
  village_name: string;
  region: string | null;
  registered_voters: number;
  quota_id: number | null;
  target_count: number;
  period: string | null;
  target_date: string | null;
  updated_at: string | null;
}

interface QuotasResponse {
  campaign?: {
    id: number;
    name: string;
    election_year: number;
  };
  quotas: QuotaItem[];
}

export default function QuotaSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<QuotasResponse>({
    queryKey: ['quotas'],
    queryFn: getQuotas,
  });
  const [search, setSearch] = useState('');
  const [pendingByVillage, setPendingByVillage] = useState<Record<number, string>>({});
  const [pendingVotersByVillage, setPendingVotersByVillage] = useState<Record<number, string>>({});
  const [changeNote, setChangeNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ villageId, targetCount }: { villageId: number; targetCount: number }) =>
      updateVillageQuota(villageId, targetCount, changeNote.trim() || undefined),
    onSuccess: (_payload, vars) => {
      setPendingByVillage((prev) => {
        const next = { ...prev };
        delete next[vars.villageId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['village'] });
      setNotice('Quota updated');
      window.setTimeout(() => setNotice(null), 2500);
    },
  });
  const villageMutation = useMutation({
    mutationFn: ({ villageId, registeredVoters }: { villageId: number; registeredVoters: number }) =>
      updateVillage(villageId, { registered_voters: registeredVoters, change_note: changeNote.trim() || undefined }),
    onSuccess: (_payload, vars) => {
      setPendingVotersByVillage((prev) => {
        const next = { ...prev };
        delete next[vars.villageId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
      queryClient.invalidateQueries({ queryKey: ['villages'] });
      queryClient.invalidateQueries({ queryKey: ['village'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNotice('Registered voters updated');
      window.setTimeout(() => setNotice(null), 2500);
    },
  });

  const quotas = useMemo(() => data?.quotas || [], [data?.quotas]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotas;
    return quotas.filter((item) =>
      item.village_name.toLowerCase().includes(q) ||
      (item.region || '').toLowerCase().includes(q)
    );
  }, [quotas, search]);

  const totalTarget = filtered.reduce((sum, row) => sum + row.target_count, 0);

  const effectiveValue = (row: QuotaItem) => {
    const pending = pendingByVillage[row.village_id];
    return pending ?? String(row.target_count);
  };

  const hasChanged = (row: QuotaItem) => {
    const parsed = Number(effectiveValue(row));
    return Number.isFinite(parsed) && parsed !== row.target_count;
  };
  const effectiveVotersValue = (row: QuotaItem) => {
    const pending = pendingVotersByVillage[row.village_id];
    return pending ?? String(row.registered_voters);
  };
  const hasVoterChanged = (row: QuotaItem) => {
    const parsed = Number(effectiveVotersValue(row));
    return Number.isFinite(parsed) && parsed !== row.registered_voters;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-neutral-400 text-sm font-medium">Loading quotas...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="app-card p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Could not load quotas</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Please refresh and try again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-[#1B3A6B] text-white px-4 py-2 rounded-xl min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-[#1B3A6B]" /> Quota Settings
        </h1>
        <p className="text-gray-500 text-sm">
          Update per-village supporter targets. Changes are audited and reflected in dashboard metrics.
        </p>
      </div>

      <div className="space-y-4">
        <div className="app-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search village or region..."
                className="w-full pl-9 pr-3 py-2 border border-[var(--border-soft)] rounded-xl min-h-[44px]"
              />
            </div>
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Change note (optional)"
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-xl min-h-[44px]"
            />
            <div className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-bg)] min-h-[44px] flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Visible total target</span>
              <span className="font-semibold text-[var(--text-primary)]">{totalTarget.toLocaleString()}</span>
            </div>
          </div>
          {notice && <p className="text-sm text-green-700 mt-2">{notice}</p>}
        </div>

        <div className="app-card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b bg-[var(--surface-bg)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Village</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Region</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Registered Voters</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Quota Target</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Updated</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const candidate = Number(effectiveValue(row));
                const votersCandidate = Number(effectiveVotersValue(row));
                const invalid = !Number.isFinite(candidate) || candidate <= 0;
                const invalidVoters = !Number.isFinite(votersCandidate) || votersCandidate <= 0;
                return (
                  <tr key={row.village_id} className="border-b">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.village_name}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{row.region || '—'}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        value={effectiveVotersValue(row)}
                        onChange={(e) => setPendingVotersByVillage((prev) => ({ ...prev, [row.village_id]: e.target.value }))}
                        className="border border-[var(--border-soft)] rounded-xl px-3 py-2 min-h-[44px] w-32"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        value={effectiveValue(row)}
                        onChange={(e) => setPendingByVillage((prev) => ({ ...prev, [row.village_id]: e.target.value }))}
                        className="border border-[var(--border-soft)] rounded-xl px-3 py-2 min-h-[44px] w-32"
                      />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={villageMutation.isPending || invalidVoters || !hasVoterChanged(row)}
                          onClick={() => {
                            if (!window.confirm(`Update registered voters for ${row.village_name} to ${votersCandidate.toLocaleString()}?`)) return;
                            villageMutation.mutate({ villageId: row.village_id, registeredVoters: votersCandidate });
                          }}
                          className="bg-[var(--surface-raised)] border border-[#1B3A6B] text-[#1B3A6B] px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" /> Save Voters
                        </button>
                        <button
                          type="button"
                          disabled={mutation.isPending || invalid || !hasChanged(row)}
                          onClick={() => {
                            if (!window.confirm(`Update quota target for ${row.village_name} to ${candidate.toLocaleString()}?`)) return;
                            mutation.mutate({ villageId: row.village_id, targetCount: candidate });
                          }}
                          className="bg-[#1B3A6B] text-white px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" /> Save Quota
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No villages match current search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          Editing guidance: set quotas to values greater than 0. Update one row at a time to avoid accidental bulk changes.
        </p>
      </div>
    </div>
  );
}
