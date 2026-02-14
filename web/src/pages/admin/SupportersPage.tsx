import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupporters, exportSupportersCsv, getVillages, updateSupporter } from '../../lib/api';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, ClipboardPlus, Download, Home, ArrowUpDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatDateTime } from '../../lib/datetime';
import { useSession } from '../../hooks/useSession';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

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
  first_name: string;
  last_name: string;
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

type SortField = 'created_at' | 'print_name' | 'village_name' | 'source' | 'registered_voter';
const SORT_FIELDS: SortField[] = ['created_at', 'print_name', 'village_name', 'source', 'registered_voter'];
const PER_PAGE_OPTIONS = [25, 50, 100, 200] as const;
type PerPage = (typeof PER_PAGE_OPTIONS)[number];

function parseSortField(value: string | null): SortField {
  return SORT_FIELDS.includes(value as SortField) ? (value as SortField) : 'created_at';
}

function parsePerPage(value: string | null): PerPage {
  const parsed = Number(value);
  return PER_PAGE_OPTIONS.includes(parsed as PerPage) ? (parsed as PerPage) : 50;
}

function supporterLabel(count: number) {
  return `${count} supporter${count === 1 ? '' : 's'}`;
}

export default function SupportersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const [returnTo] = useState(searchParams.get('return_to') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [villageFilter, setVillageFilter] = useState(searchParams.get('village_id') || '');
  const [precinctFilter, setPrecinctFilter] = useState(searchParams.get('precinct_id') || '');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || '');
  const [unassignedPrecinct, setUnassignedPrecinct] = useState(searchParams.get('unassigned_precinct') === 'true');
  const [sortBy, setSortBy] = useState<SortField>(parseSortField(searchParams.get('sort_by')));
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((searchParams.get('sort_dir') as 'asc' | 'desc') || 'desc');
  const [perPage, setPerPage] = useState<PerPage>(parsePerPage(searchParams.get('per_page')));
  const [page, setPage] = useState(1);
  const [visibleRows, setVisibleRows] = useState(80);
  const [pendingPrecinctBySupporter, setPendingPrecinctBySupporter] = useState<Record<number, string>>({});
  const prefersReducedMotion = useReducedMotion();
  const debouncedSearch = useDebouncedValue(search, 250);

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
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (villageFilter) params.set('village_id', villageFilter);
    if (precinctFilter) params.set('precinct_id', precinctFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    if (unassignedPrecinct) params.set('unassigned_precinct', 'true');
    params.set('sort_by', sortBy);
    params.set('sort_dir', sortDir);
    params.set('per_page', String(perPage));
    if (returnTo) params.set('return_to', returnTo);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, villageFilter, precinctFilter, sourceFilter, unassignedPrecinct, sortBy, sortDir, perPage, returnTo, setSearchParams]);

  const { data, isFetching } = useQuery<SupportersResponse>({
    queryKey: ['supporters', debouncedSearch, villageFilter, precinctFilter, sourceFilter, unassignedPrecinct, sortBy, sortDir, page, perPage],
    queryFn: () => getSupporters({
      search: debouncedSearch,
      village_id: villageFilter || undefined,
      precinct_id: precinctFilter || undefined,
      source: sourceFilter || undefined,
      unassigned_precinct: unassignedPrecinct ? 'true' : undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      page,
      per_page: perPage,
    }),
    placeholderData: (previous) => previous,
  });
  const highVolumeMode = (data?.pagination.total || 0) >= 5000;
  const shouldAnimateRows = !prefersReducedMotion && !highVolumeMode;
  const progressiveRenderingEnabled = highVolumeMode && perPage >= 100;
  const supportersRows = data?.supporters || [];
  const effectiveVisibleRows = progressiveRenderingEnabled
    ? Math.min(visibleRows, supportersRows.length)
    : supportersRows.length;
  const visibleSupporters = supportersRows.slice(0, effectiveVisibleRows);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisibleRows(80), 0);
    return () => window.clearTimeout(timer);
  }, [progressiveRenderingEnabled, page, debouncedSearch, villageFilter, precinctFilter, sourceFilter, unassignedPrecinct, sortBy, sortDir, perPage]);

  useEffect(() => {
    if (!progressiveRenderingEnabled) return;
    if (effectiveVisibleRows >= supportersRows.length) return;

    const timer = window.setTimeout(() => {
      setVisibleRows((prev) => Math.min(prev + 60, supportersRows.length));
    }, 16);
    return () => window.clearTimeout(timer);
  }, [progressiveRenderingEnabled, effectiveVisibleRows, supportersRows.length]);

  useEffect(() => {
    if (!data) return;
    const totalPages = data.pagination.pages;
    if (page < totalPages) {
      void queryClient.prefetchQuery({
        queryKey: ['supporters', debouncedSearch, villageFilter, precinctFilter, sourceFilter, unassignedPrecinct, sortBy, sortDir, page + 1, perPage],
        queryFn: () => getSupporters({
          search: debouncedSearch,
          village_id: villageFilter || undefined,
          precinct_id: precinctFilter || undefined,
          source: sourceFilter || undefined,
          unassigned_precinct: unassignedPrecinct ? 'true' : undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
          page: page + 1,
          per_page: perPage,
        }),
      });
    }
  }, [data, page, perPage, debouncedSearch, villageFilter, precinctFilter, sourceFilter, unassignedPrecinct, sortBy, sortDir, queryClient]);

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
    if (!sessionData?.permissions?.can_edit_supporters) {
      return <span className="text-gray-400">Unassigned</span>;
    }

    const village = villagesById.get(supporter.village_id);
    const precincts = village?.precincts || [];
    if (precincts.length === 0) {
      return <span className="text-gray-400">No precinct data</span>;
    }

    const pendingValue = pendingPrecinctBySupporter[supporter.id] || '';
    const isSaving = assignPrecinctMutation.isPending;

    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={pendingValue}
          onChange={(e) => setPendingPrecinctBySupporter((prev) => ({ ...prev, [supporter.id]: e.target.value }))}
          className="border border-gray-300 rounded-xl px-3 py-2 min-h-[44px] text-sm bg-white"
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
          className="px-3 py-2 rounded-xl min-h-[44px] bg-[#1B3A6B] text-white text-sm disabled:opacity-50"
        >
          Save
        </button>
      </div>
    );
  };

  const supporterDetailLink = (supporterId: number) =>
    `/admin/supporters/${supporterId}?return_to=${encodeURIComponent(`/admin/supporters?${searchParams.toString()}`)}`;

  const handleSort = (field: SortField) => {
    setPage(1);
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortDir(field === 'created_at' ? 'desc' : 'asc');
  };

  const sortLabel = (field: SortField) => {
    if (sortBy !== field) return '';
    return sortDir === 'asc' ? '▲' : '▼';
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
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
            <h1 className="text-2xl font-bold tracking-tight">All Supporters</h1>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => exportSupportersCsv({ village_id: villageFilter || undefined })}
                className="bg-white/10 hover:bg-white/20 px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              {sessionData?.permissions?.can_create_staff_supporters && (
                <Link to="/admin/supporters/new" className="bg-[#C41E3A] hover:bg-[#a01830] px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center gap-1">
                  <ClipboardPlus className="w-4 h-4" /> New Entry
                </Link>
              )}
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
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
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
            className="md:col-span-3 px-3 py-3 border border-gray-300 rounded-xl bg-white text-gray-700 focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent min-w-0"
          >
            <option value="">All Villages</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="md:col-span-2 px-3 py-3 border border-gray-300 rounded-xl bg-white text-gray-700 focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent min-w-0"
          >
            <option value="">All sources</option>
            <option value="qr_signup">Public signup</option>
            <option value="staff_entry">Staff entry</option>
          </select>
          {villageFilter && (
            <select
              value={precinctFilter}
              onChange={(e) => {
                setPrecinctFilter(e.target.value);
                if (e.target.value) setUnassignedPrecinct(false);
                setPage(1);
              }}
              className="md:col-span-2 px-3 py-3 border border-gray-300 rounded-xl bg-white text-gray-700 focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent min-w-0"
            >
              <option value="">All precincts</option>
              {selectedVillagePrecincts.map((p) => (
                <option key={p.id} value={p.id}>Precinct {p.number}</option>
              ))}
            </select>
          )}
          <select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(':') as [SortField, 'asc' | 'desc'];
              setSortBy(field);
              setSortDir(dir);
              setPage(1);
            }}
            className="md:col-span-2 px-3 py-3 border border-gray-300 rounded-xl bg-white text-gray-700 focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent min-w-0"
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="print_name:asc">Name A-Z</option>
            <option value="print_name:desc">Name Z-A</option>
            <option value="village_name:asc">Village A-Z</option>
            <option value="village_name:desc">Village Z-A</option>
          </select>
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
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              {supporterLabel(data.pagination.total)} total (page {data.pagination.page} of {data.pagination.pages})
            </p>
            <div className="flex items-center gap-3">
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value) as PerPage);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-xl px-2 py-1.5 bg-white text-xs text-gray-700"
                aria-label="Rows per page"
              >
                {PER_PAGE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}/page</option>
                ))}
              </select>
              <p
                aria-live="polite"
                className={`text-xs text-gray-400 transition-opacity duration-200 ${isFetching ? 'opacity-100' : 'opacity-0'}`}
              >
                {search !== debouncedSearch ? 'Searching...' : 'Updating...'}
              </p>
            </div>
          </div>
        )}

        {/* Mobile Card View */}
        <div className={`md:hidden space-y-3 transition-opacity duration-200 ${isFetching ? 'opacity-70' : 'opacity-100'}`}>
          {visibleSupporters.map((s) => (
            <div key={s.id} className="app-card p-4">
              <div className="flex items-center justify-between mb-1">
                <Link to={supporterDetailLink(s.id)} className="font-semibold text-gray-900 hover:underline">
                  {s.last_name}, {s.first_name}
                </Link>
                <span className={`app-chip ${
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
                    <span className="app-chip bg-amber-100 text-amber-700">Yard Sign</span>
                  )}
                  {s.motorcade_available && (
                    <span className="app-chip bg-cyan-100 text-cyan-700">Motorcade</span>
                  )}
                  {!s.yard_sign && !s.motorcade_available && (
                    <span className="text-xs text-gray-400">No extra flags</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className={s.registered_voter ? 'text-green-600 font-medium' : 'text-gray-400'}>{s.registered_voter ? 'Registered' : 'Not registered'}</span>
                  <span>{formatDateTime(s.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
          {supportersRows.length === 0 && (
            <div className="text-center text-gray-400 py-8">No supporters found</div>
          )}
          {progressiveRenderingEnabled && effectiveVisibleRows < supportersRows.length && (
            <div className="text-center text-xs text-gray-400 py-2">
              Rendering {effectiveVisibleRows} / {supportersRows.length} rows...
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className={`hidden md:block app-card overflow-x-auto transition-opacity duration-200 ${isFetching ? 'opacity-80' : 'opacity-100'}`}>
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  <button type="button" onClick={() => handleSort('print_name')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    Name <ArrowUpDown className="w-3.5 h-3.5" /> {sortLabel('print_name')}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  <button type="button" onClick={() => handleSort('village_name')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    Village <ArrowUpDown className="w-3.5 h-3.5" /> {sortLabel('village_name')}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Precinct</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Flags</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  <button type="button" onClick={() => handleSort('registered_voter')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    Registered <ArrowUpDown className="w-3.5 h-3.5" /> {sortLabel('registered_voter')}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  <button type="button" onClick={() => handleSort('source')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    Source <ArrowUpDown className="w-3.5 h-3.5" /> {sortLabel('source')}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  <button type="button" onClick={() => handleSort('created_at')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    Date <ArrowUpDown className="w-3.5 h-3.5" /> {sortLabel('created_at')}
                  </button>
                </th>
              </tr>
            </thead>
            <motion.tbody layout={shouldAnimateRows}>
              {visibleSupporters.map((s) => (
                <motion.tr
                  key={s.id}
                  layout={shouldAnimateRows}
                  transition={shouldAnimateRows ? { type: 'spring', stiffness: 380, damping: 34 } : { duration: 0 }}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[240px]">
                    <Link to={supporterDetailLink(s.id)} className="hover:underline block truncate" title={`${s.last_name}, ${s.first_name}`}>
                      {s.last_name}, {s.first_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.contact_number}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.village_name}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{renderPrecinctAssignControl(s)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      {s.yard_sign && (
                        <span className="app-chip bg-amber-100 text-amber-700">Yard</span>
                      )}
                      {s.motorcade_available && (
                        <span className="app-chip bg-cyan-100 text-cyan-700">Motorcade</span>
                      )}
                      {!s.yard_sign && !s.motorcade_available && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.registered_voter ? (
                      <span className="text-green-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`app-chip ${
                      s.source === 'qr_signup' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {s.source === 'qr_signup' ? 'Public Signup' : 'Staff Entry'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                </motion.tr>
              ))}
              {supportersRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No supporters found
                  </td>
                </tr>
              )}
            </motion.tbody>
          </table>
          {progressiveRenderingEnabled && effectiveVisibleRows < supportersRows.length && (
            <div className="px-4 py-2 text-xs text-gray-400">
              Rendering {effectiveVisibleRows} / {supportersRows.length} rows...
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 min-h-[44px] border rounded-xl disabled:opacity-30 hover:bg-gray-100"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-600">Page {page} of {data.pagination.pages}</span>
            <button
              disabled={page >= data.pagination.pages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 min-h-[44px] border rounded-xl disabled:opacity-30 hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
