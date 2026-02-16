import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Home, Save, Search } from 'lucide-react';
import { getPrecincts, updatePrecinct } from '../../lib/api';

interface PrecinctItem {
  id: number;
  number: string;
  alpha_range: string | null;
  polling_site: string | null;
  registered_voters: number;
  active: boolean;
  village_id: number;
  village_name: string;
  linked_supporters_count: number;
  updated_at: string | null;
}

interface PrecinctsResponse {
  precincts: PrecinctItem[];
}

interface PrecinctDraft {
  number: string;
  alpha_range: string;
  polling_site: string;
  registered_voters: string;
  active: boolean;
}
interface PrecinctUpdatePayload {
  number: string;
  alpha_range: string;
  polling_site: string;
  registered_voters: number;
  active: boolean;
  change_note?: string;
}

export default function PrecinctSettingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [draftByPrecinct, setDraftByPrecinct] = useState<Record<number, PrecinctDraft>>({});
  const [changeNote, setChangeNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PrecinctsResponse>({
    queryKey: ['precincts', villageFilter, search, statusFilter],
    queryFn: () => getPrecincts({
      search: search || undefined,
      status: statusFilter || undefined,
    }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PrecinctUpdatePayload }) => updatePrecinct(id, payload),
    onSuccess: (_payload, vars) => {
      setDraftByPrecinct((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['precincts'] });
      queryClient.invalidateQueries({ queryKey: ['villages'] });
      queryClient.invalidateQueries({ queryKey: ['village'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNotice('Precinct updated');
      window.setTimeout(() => setNotice(null), 2500);
    },
  });

  const precincts = useMemo(() => data?.precincts || [], [data?.precincts]);
  const villageOptions = useMemo(
    () => Array.from(new Set(precincts.map((p) => p.village_name))).sort((a, b) => a.localeCompare(b)),
    [precincts]
  );

  const getDraft = (row: PrecinctItem): PrecinctDraft => {
    return draftByPrecinct[row.id] || {
      number: row.number || '',
      alpha_range: row.alpha_range || '',
      polling_site: row.polling_site || '',
      registered_voters: String(row.registered_voters ?? ''),
      active: row.active,
    };
  };

  const hasChanged = (row: PrecinctItem, draft: PrecinctDraft) =>
    draft.number.trim() !== row.number ||
    draft.alpha_range.trim() !== (row.alpha_range || '') ||
    draft.polling_site.trim() !== (row.polling_site || '') ||
    Number(draft.registered_voters) !== row.registered_voters ||
    draft.active !== row.active;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-blue-300/60 text-sm font-medium">Loading precincts...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="app-card p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Could not load precincts</h1>
          <p className="text-sm text-gray-600 mb-4">Please refresh and try again.</p>
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
    <div className="min-h-screen">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm">
              <Home className="w-4 h-4" /> Home
            </Link>
          </div>
          <h1 className="text-xl font-bold">Precinct Settings</h1>
          <p className="text-blue-200 text-sm">Edit precinct metadata safely without breaking supporter assignments.</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="app-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search precinct, village, alpha range, polling site..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl min-h-[44px]"
            />
          </div>
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Change note (optional)"
            className="border border-gray-300 rounded-xl px-3 py-2 min-h-[44px]"
          />
          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 bg-white min-h-[44px]"
          >
            <option value="">All villages</option>
            {villageOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 bg-white min-h-[44px]"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {notice && (
            <p className="text-sm text-green-700 md:col-span-4">{notice}</p>
          )}
        </div>

        <div className="app-card overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Village</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Precinct #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Alpha Range</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Polling Site</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registered Voters</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Linked Supporters</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {precincts
                .filter((p) => !villageFilter || p.village_name === villageFilter)
                .map((row) => {
                  const draft = getDraft(row);
                  const votersCount = Number(draft.registered_voters);
                  const invalid = draft.number.trim().length === 0 || !Number.isFinite(votersCount) || votersCount <= 0;
                  const disableDeactivate = row.linked_supporters_count > 0 && row.active;
                  return (
                    <tr key={row.id} className="border-b">
                      <td className="px-4 py-3 text-gray-900">{row.village_name}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={draft.number}
                          onChange={(e) => setDraftByPrecinct((prev) => ({ ...prev, [row.id]: { ...draft, number: e.target.value } }))}
                          className="border border-gray-300 rounded-xl px-3 py-2 min-h-[44px] w-24"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={draft.alpha_range}
                          onChange={(e) => setDraftByPrecinct((prev) => ({ ...prev, [row.id]: { ...draft, alpha_range: e.target.value } }))}
                          className="border border-gray-300 rounded-xl px-3 py-2 min-h-[44px] w-28"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={draft.polling_site}
                          onChange={(e) => setDraftByPrecinct((prev) => ({ ...prev, [row.id]: { ...draft, polling_site: e.target.value } }))}
                          className="border border-gray-300 rounded-xl px-3 py-2 min-h-[44px] w-64"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          value={draft.registered_voters}
                          onChange={(e) => setDraftByPrecinct((prev) => ({ ...prev, [row.id]: { ...draft, registered_voters: e.target.value } }))}
                          className="border border-gray-300 rounded-xl px-3 py-2 min-h-[44px] w-32"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={draft.active}
                            disabled={disableDeactivate}
                            onChange={(e) => setDraftByPrecinct((prev) => ({ ...prev, [row.id]: { ...draft, active: e.target.checked } }))}
                            className="rounded border-gray-300 text-[#1B3A6B]"
                          />
                          {draft.active ? 'Active' : 'Inactive'}
                        </label>
                        {disableDeactivate && (
                          <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Assigned supporters block deactivation
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.linked_supporters_count}</td>
                      <td className="px-4 py-3 text-gray-500">{row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={mutation.isPending || invalid || !hasChanged(row, draft)}
                          onClick={() => {
                            const votersChanged = votersCount !== row.registered_voters;
                            const deactivating = row.active && !draft.active;
                            if (
                              votersChanged &&
                              !window.confirm(
                                `Update registered voters for Precinct ${row.number} (${row.village_name}) from ${row.registered_voters.toLocaleString()} to ${votersCount.toLocaleString()}?`
                              )
                            ) {
                              return;
                            }
                            if (
                              deactivating &&
                              !window.confirm(`Deactivate Precinct ${row.number} (${row.village_name})?`)
                            ) {
                              return;
                            }
                            mutation.mutate({
                              id: row.id,
                              payload: {
                                number: draft.number.trim(),
                                alpha_range: draft.alpha_range.trim(),
                                polling_site: draft.polling_site.trim(),
                                registered_voters: votersCount,
                                active: draft.active,
                                change_note: changeNote.trim(),
                              },
                            });
                          }}
                          className="bg-[#1B3A6B] text-white px-3 py-2 rounded-xl min-h-[44px] text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" /> Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {precincts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">No precincts match current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
