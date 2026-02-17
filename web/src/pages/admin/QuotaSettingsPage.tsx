import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Search, Target, TrendingUp } from 'lucide-react';
import { getQuotas, updateVillageQuota, getSettings, updateSettings } from '../../lib/api';

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

interface SettingsResponse {
  show_pace: boolean;
}

export default function QuotaSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<QuotasResponse>({
    queryKey: ['quotas'],
    queryFn: getQuotas,
  });
  const { data: settings } = useQuery<SettingsResponse>({
    queryKey: ['settings'],
    queryFn: getSettings,
  });
  const paceMutation = useMutation({
    mutationFn: (showPace: boolean) => updateSettings({ show_pace: showPace }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const [search, setSearch] = useState('');
  const [pendingByVillage, setPendingByVillage] = useState<Record<number, string>>({});
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
  const totalVoters = filtered.reduce((sum, row) => sum + row.registered_voters, 0);

  const effectiveValue = (row: QuotaItem) => {
    const pending = pendingByVillage[row.village_id];
    return pending ?? String(row.target_count);
  };

  const hasChanged = (row: QuotaItem) => {
    const parsed = Number(effectiveValue(row));
    return Number.isFinite(parsed) && parsed !== row.target_count;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--text-muted)] text-sm font-medium">Loading quotas...</div>
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
          Set per-village supporter targets. Voter counts come from GEC precinct data (edit on Precinct Settings).
        </p>
      </div>

      {/* Pace Tracking Toggle */}
      <div className="app-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <TrendingUp className="w-[18px] h-[18px] text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Pace Tracking</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Show expected progress and weekly targets on the dashboard
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings?.show_pace ?? false}
            disabled={paceMutation.isPending}
            onClick={() => paceMutation.mutate(!(settings?.show_pace ?? false))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              settings?.show_pace ? 'bg-[#1B3A6B]' : 'bg-gray-300'
            } ${paceMutation.isPending ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                settings?.show_pace ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
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
              <span className="text-[var(--text-secondary)]">Total target</span>
              <span className="font-semibold text-[var(--text-primary)]">{totalTarget.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Total registered voters: <span className="font-semibold">{totalVoters.toLocaleString()}</span> (from GEC Jan 2026)
          </div>
          {notice && <p className="text-sm text-green-700 mt-2">{notice}</p>}
        </div>

        <div className="app-card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b bg-[var(--surface-bg)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Village</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Region</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Registered Voters</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Quota Target</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Updated</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const candidate = Number(effectiveValue(row));
                const invalid = !Number.isFinite(candidate) || candidate <= 0;
                return (
                  <tr key={row.village_id} className="border-b">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.village_name}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{row.region || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">{row.registered_voters.toLocaleString()}</td>
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
                      <button
                        type="button"
                        disabled={mutation.isPending || invalid || !hasChanged(row)}
                        onClick={() => {
                          if (!window.confirm(`Update quota target for ${row.village_name} to ${candidate.toLocaleString()}?`)) return;
                          mutation.mutate({ villageId: row.village_id, targetCount: candidate });
                        }}
                        className="bg-[#1B3A6B] text-white px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
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
          Voter counts are from GEC precinct data (Jan 2026). To update voter numbers, go to Precinct Settings.
        </p>
      </div>
    </div>
  );
}
