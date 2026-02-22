import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOutreachSupporters, updateOutreachStatus } from '../../lib/api';
import { formatDateTime } from '../../lib/datetime';

interface OutreachSupporter {
  id: number;
  first_name: string;
  last_name: string;
  village_name: string;
  contact_number: string;
  email: string | null;
  registration_outreach_status: string | null;
  registration_outreach_date: string | null;
  registration_outreach_notes: string | null;
}

interface OutreachCounts {
  total: number;
  not_contacted: number;
  contacted: number;
  registered: number;
  declined: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'registered', label: 'Registered' },
  { value: 'declined', label: 'Declined' },
];

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  contacted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Contacted' },
  registered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Registered' },
  declined: { bg: 'bg-red-100', text: 'text-red-800', label: 'Declined' },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Not Contacted</span>;
  }
  const badge = STATUS_BADGES[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>;
}

export default function OutreachPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const params: Record<string, string | number> = { page, per_page: 50 };
  if (search) params.search = search;
  if (statusFilter && statusFilter !== 'not_contacted') {
    params.outreach_status = statusFilter;
  }

  const { data, isLoading } = useQuery({
    queryKey: ['outreach', page, search, statusFilter],
    queryFn: () => getOutreachSupporters(params),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateOutreachStatus(id, { registration_outreach_status: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach'] });
    },
  });

  const supporters: OutreachSupporter[] = data?.supporters || [];
  const counts: OutreachCounts = data?.counts || { total: 0, not_contacted: 0, contacted: 0, registered: 0, declined: 0 };
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[#1B3A6B]" /> Voter Outreach
        </h1>
        <p className="text-gray-500 text-sm mt-1">Non-registered supporters needing voter registration outreach</p>
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{counts.total}</div>
          <div className="text-xs text-gray-500">Total Unregistered</div>
        </div>
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-gray-500">{counts.not_contacted}</div>
          <div className="text-xs text-gray-500">Not Contacted</div>
        </div>
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{counts.contacted}</div>
          <div className="text-xs text-gray-500">Contacted</div>
        </div>
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{counts.registered}</div>
          <div className="text-xs text-gray-500">Registered</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="app-card overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : supporters.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No supporters found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 hidden sm:table-cell">Village</th>
                <th className="px-4 py-3 hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 hidden lg:table-cell">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Last Contact</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {supporters.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/supporters/${s.id}`} className="text-[#1B3A6B] hover:underline font-medium">
                      {s.first_name} {s.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{s.village_name}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.contact_number || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{s.email || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.registration_outreach_status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {s.registration_outreach_date ? formatDateTime(s.registration_outreach_date) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={s.registration_outreach_status || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          updateMutation.mutate({ id: s.id, status: e.target.value });
                        }
                      }}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white min-w-[120px]"
                    >
                      <option value="">Set status...</option>
                      <option value="contacted">Contacted</option>
                      <option value="registered">Registered</option>
                      <option value="declined">Declined</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
