import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPublicReview, getVillages, acceptToQuota } from '../../lib/api';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  UserPlus,
  Search,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function TeamPublicReviewPage() {
  const queryClient = useQueryClient();
  const [villageId, setVillageId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: villages } = useQuery({ queryKey: ['villages'], queryFn: getVillages });
  const { data, isLoading } = useQuery({
    queryKey: ['public-review', villageId, search, page],
    queryFn: () => getPublicReview({
      village_id: villageId || undefined,
      search: search || undefined,
      page,
      per_page: 50,
    }),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => acceptToQuota(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-review'] }),
  });

  const supporters = data?.supporters || [];
  const summary = data?.summary || {};
  const pagination = data?.pagination || {};

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Public Signup Review</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review public signups and accept into the quota pipeline</p>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
          <div className="text-xl font-bold text-blue-900">{summary.total_public || 0}</div>
          <div className="text-[10px] text-blue-600 font-medium uppercase">Pending Review</div>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3">
          <div className="text-xl font-bold text-green-900">{summary.accepted || 0}</div>
          <div className="text-[10px] text-green-600 font-medium uppercase">Accepted</div>
        </div>
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
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
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

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 animate-pulse rounded-xl" />)}
        </div>
      ) : supporters.length === 0 ? (
        <div className="text-center py-16">
          <UserCheck className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">No public signups to review</h3>
          <p className="text-sm text-gray-400 mt-1">All public signups have been reviewed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Village</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Phone</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Source</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Registered</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {supporters.map((s: Record<string, unknown>) => (
                <tr key={s.id as number} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link to={`/admin/supporters/${s.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {s.first_name as string} {s.last_name as string}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{s.village_name as string}</td>
                  <td className="py-3 px-4 text-gray-600">{s.contact_number as string || '-'}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {(s.source as string)?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{new Date(s.created_at as string).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    {s.registered_voter ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-xs text-red-500">No</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => acceptMutation.mutate(s.id as number)}
                      disabled={acceptMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <span className="flex items-center gap-1">
                        <UserPlus className="w-3 h-3" />
                        Accept
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500">Page {page} of {pagination.pages}</span>
          <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
