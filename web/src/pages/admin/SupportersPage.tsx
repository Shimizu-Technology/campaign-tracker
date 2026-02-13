import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupporters, exportSupportersCsv, getVillages, updateSupporter } from '../../lib/api';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, ClipboardPlus, Download, Home } from 'lucide-react';

interface VillageOption {
  id: number;
  name: string;
  precincts: {
    id: number;
    number: string;
    alpha_range: string;
  }[];
}

interface SupporterItem {
  id: number;
  print_name: string;
  contact_number: string;
  village_id: number;
  village_name: string;
  precinct_id: number | null;
  precinct_number: string | null;
  registered_voter: boolean;
  yard_sign: boolean;
  motorcade_available: boolean;
  source: string;
  created_at: string;
}

interface SupportersResponse {
  supporters: SupporterItem[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
}

export default function SupportersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [returnTo] = useState(searchParams.get('return_to') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [villageFilter, setVillageFilter] = useState(searchParams.get('village_id') || '');
  const [precinctFilter, setPrecinctFilter] = useState(searchParams.get('precinct_id') || '');
  const [unassignedPrecinct, setUnassignedPrecinct] = useState(searchParams.get('unassigned_precinct') === 'true');
  const [page, setPage] = useState(1);
  const [pendingPrecinctBySupporter, setPendingPrecinctBySupporter] = useState<Record<number, string>>({});

  const { data: villageData } = useQuery({ queryKey: ['villages'], queryFn: getVillages });
  const villages: VillageOption[] = useMemo(() => villageData?.villages || [], [villageData]);
  const villagesById = useMemo(
    () => new Map(villages.map((v) => [v.id, v])),
    [villages]
  );
  const selectedVillagePrecincts = useMemo(
    () => (villageFilter ? villagesById.get(Number(villageFilter))?.precincts || [] : []),
    [villageFilter, villagesById]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (villageFilter) params.set('village_id', villageFilter);
    if (precinctFilter) params.set('precinct_id', precinctFilter);
    if (unassignedPrecinct) params.set('unassigned_precinct', 'true');
    if (returnTo) params.set('return_to', returnTo);
    setSearchParams(params, { replace: true });
  }, [search, villageFilter, precinctFilter, unassignedPrecinct, returnTo, setSearchParams]);

  const { data } = useQuery<SupportersResponse>({
    queryKey: ['supporters', search, villageFilter, precinctFilter, unassignedPrecinct, page],
    queryFn: () => getSupporters({
      search,
      village_id: villageFilter || undefined,
      precinct_id: precinctFilter || undefined,
      unassigned_precinct: unassignedPrecinct ? 'true' : undefined,
      page
    }),
  });

  const assignPrecinctMutation = useMutation({
    mutationFn: ({ supporterId, precinctId }: { supporterId: number; precinctId: number }) =>
      updateSupporter(supporterId, { precinct_id: precinctId }),
    onSuccess: (_data, variables) => {
      setPendingPrecinctBySupporter((prev) => {
        const next = { ...prev };
        delete next[variables.supporterId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['supporters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['village'] });
    },
  });

  const renderPrecinctAssignControl = (supporter: SupporterItem) => {
    if (supporter.precinct_number) {
      return <span className="text-gray-700">Precinct {supporter.precinct_number}</span>;
    }

    const village = villagesById.get(supporter.village_id);
    const precincts = village?.precincts || [];
    if (precincts.length === 0) {
      return <span className="text-gray-400">No precinct data</span>;
    }

    const pendingValue = pendingPrecinctBySupporter[supporter.id] || '';
    const isSaving = assignPrecinctMutation.isPending;

    return (
      <div className="flex items-center gap-2">
        <select
          value={pendingValue}
          onChange={(e) => setPendingPrecinctBySupporter((prev) => ({ ...prev, [supporter.id]: e.target.value }))}
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          disabled={isSaving}
        >
          <option value="">Assign precinct</option>
          {precincts.map((p) => (
            <option key={p.id} value={p.id}>Precinct {p.number}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!pendingValue || isSaving}
          onClick={() => assignPrecinctMutation.mutate({ supporterId: supporter.id, precinctId: Number(pendingValue) })}
          className="px-2 py-1 rounded bg-[#1B3A6B] text-white text-xs disabled:opacity-50"
        >
          Save
        </button>
      </div>
    );
  };

  const supporterDetailLink = (supporterId: number) =>
    `/admin/supporters/${supporterId}?return_to=${encodeURIComponent(`/admin/supporters?${searchParams.toString()}`)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2 gap-3">
            <button
              type="button"
              onClick={() => navigate(returnTo || -1)}
              className="flex items-center gap-2 text-blue-200 hover:text-white text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm">
              <Home className="w-4 h-4" /> Home
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-xl font-bold">All Supporters</h1>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => exportSupportersCsv({ village_id: villageFilter || undefined })}
                className="bg-white/10 hover:bg-white/20 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              <Link to="/admin/supporters/new" className="bg-[#C41E3A] hover:bg-[#a01830] px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium flex items-center gap-1">
                <ClipboardPlus className="w-4 h-4" /> New Entry
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
          <div className="relative md:col-span-5 min-w-0">
            <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or phone..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
            />
          </div>
          <select
            value={villageFilter}
            onChange={e => {
              setVillageFilter(e.target.value);
              setPrecinctFilter('');
              setUnassignedPrecinct(false);
              setPage(1);
            }}
            className="md:col-span-3 px-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent min-w-0"
          >
            <option value="">All Villages</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          {villageFilter && (
            <select
              value={precinctFilter}
              onChange={(e) => {
                setPrecinctFilter(e.target.value);
                if (e.target.value) setUnassignedPrecinct(false);
                setPage(1);
              }}
              className="md:col-span-2 px-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent min-w-0"
            >
              <option value="">All precincts</option>
              {selectedVillagePrecincts.map((p) => (
                <option key={p.id} value={p.id}>Precinct {p.number}</option>
              ))}
            </select>
          )}
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap min-h-[44px]">
            <input
              type="checkbox"
              checked={unassignedPrecinct}
              onChange={(e) => {
                const checked = e.target.checked;
                setUnassignedPrecinct(checked);
                if (checked) setPrecinctFilter('');
                setPage(1);
              }}
              className="rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
            />
            Unassigned precinct
          </label>
        </div>

        {/* Count */}
        {data && (
          <p className="text-sm text-gray-500 mb-4">
            {data.pagination.total} supporters total (page {data.pagination.page} of {data.pagination.pages})
          </p>
        )}

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {data?.supporters?.map((s) => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-1">
                <Link to={supporterDetailLink(s.id)} className="font-semibold text-gray-900 hover:underline">
                  {s.print_name}
                </Link>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  s.source === 'qr_signup' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {s.source === 'qr_signup' ? 'QR' : 'Staff'}
                </span>
              </div>
              <div className="text-sm text-gray-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>{s.village_name}</span>
                  <span>{s.contact_number}</span>
                </div>
                <div>{renderPrecinctAssignControl(s)}</div>
                <div className="flex items-center gap-2 pt-1">
                  {s.yard_sign && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Yard Sign</span>
                  )}
                  {s.motorcade_available && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700">Motorcade</span>
                  )}
                  {!s.yard_sign && !s.motorcade_available && (
                    <span className="text-xs text-gray-400">No extra flags</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className={s.registered_voter ? 'text-green-600 font-medium' : 'text-gray-400'}>{s.registered_voter ? 'Registered' : 'Not registered'}</span>
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
          {data?.supporters?.length === 0 && (
            <div className="text-center text-gray-400 py-8">No supporters found</div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Village</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Precinct</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Flags</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registered</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.supporters?.map((s) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={supporterDetailLink(s.id)} className="hover:underline">
                      {s.print_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.contact_number}</td>
                  <td className="px-4 py-3 text-gray-600">{s.village_name}</td>
                  <td className="px-4 py-3 text-gray-600">{renderPrecinctAssignControl(s)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      {s.yard_sign && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Yard</span>
                      )}
                      {s.motorcade_available && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700">Motorcade</span>
                      )}
                      {!s.yard_sign && !s.motorcade_available && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.registered_voter ? (
                      <span className="text-green-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      s.source === 'qr_signup' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {s.source === 'qr_signup' ? 'Public Signup' : 'Staff Entry'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {data?.supporters?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No supporters found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 min-h-[44px] border rounded-lg disabled:opacity-30 hover:bg-gray-100"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-600">Page {page} of {data.pagination.pages}</span>
            <button
              disabled={page >= data.pagination.pages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 min-h-[44px] border rounded-lg disabled:opacity-30 hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
