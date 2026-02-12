import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupporters } from '../../lib/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, ClipboardPlus, Download } from 'lucide-react';

export default function SupportersPage() {
  const [search, setSearch] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['supporters', search, villageFilter, page],
    queryFn: () => getSupporters({ search, village_id: villageFilter || undefined, page }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">All Supporters</h1>
            <Link to="/admin/supporters/new" className="bg-[#C41E3A] hover:bg-[#a01830] px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1">
              <ClipboardPlus className="w-4 h-4" /> New Entry
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or phone..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
          />
        </div>

        {/* Count */}
        {data && (
          <p className="text-sm text-gray-500 mb-4">
            {data.pagination.total} supporters total (page {data.pagination.page} of {data.pagination.pages})
          </p>
        )}

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {data?.supporters?.map((s: any) => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">{s.print_name}</span>
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
                <div className="flex justify-between">
                  <span>{s.registered_voter ? '✓ Registered' : 'Not registered'}</span>
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registered</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.supporters?.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.print_name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.contact_number}</td>
                  <td className="px-4 py-3 text-gray-600">{s.village_name}</td>
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
                      {s.source === 'qr_signup' ? 'QR Signup' : 'Staff Entry'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {data?.supporters?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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
              className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-100"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-600">Page {page} of {data.pagination.pages}</span>
            <button
              disabled={page >= data.pagination.pages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
