import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGecStats, getGecImports, uploadGecList, bulkVetSupporters } from '../../lib/api';
import {
  Database,
  Upload,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
} from 'lucide-react';

export default function TeamGecPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [listDate, setListDate] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [importType, setImportType] = useState<'full_list' | 'changes_only'>('full_list');

  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['gec-stats'], queryFn: getGecStats });
  const { data: imports } = useQuery({ queryKey: ['gec-imports'], queryFn: getGecImports });

  const uploadMutation = useMutation({
    mutationFn: () => uploadGecList(file!, listDate, sheetName || undefined, importType),
    onSuccess: (data) => {
      setFile(null);
      setListDate('');
      setSheetName('');
      setImportType('full_list');
      queryClient.invalidateQueries({ queryKey: ['gec-stats'] });
      queryClient.invalidateQueries({ queryKey: ['gec-imports'] });
      const s = data.stats;
      const lines = [
        `Import successful!`,
        ``,
        `Total processed: ${s.total}`,
        `New voters: ${s.new}`,
        `Updated: ${s.updated}`,
        s.removed ? `Purged (removed from list): ${s.removed}` : null,
        s.transferred ? `Village transfers detected: ${s.transferred}` : null,
        s.re_vetted ? `Supporters re-flagged for review: ${s.re_vetted}` : null,
        s.ambiguous_dob ? `Ambiguous DOBs: ${s.ambiguous_dob}` : null,
      ].filter(Boolean);
      alert(lines.join('\n'));
    },
    onError: (err: Error) => alert(`Import failed: ${err.message}`),
  });

  const bulkVetMutation = useMutation({
    mutationFn: () => bulkVetSupporters({ unverified_only: 'true' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vetting-queue'] });
      alert(`Bulk vetting complete!\n\nAuto-verified: ${data.results.auto_verified}\nFlagged: ${data.results.flagged}\nReferrals: ${data.results.referral}\nUnregistered: ${data.results.unregistered}`);
    },
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">GEC Voter List</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage the Guam Election Commission voter registration data</p>
      </div>

      {/* Current Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-500" />
          Current Status
        </h2>
        {statsLoading ? (
          <div className="animate-pulse h-20 bg-gray-100 rounded-lg" />
        ) : stats?.total_voters ? (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <div className="text-2xl font-bold text-gray-900">{(stats.total_voters || 0).toLocaleString()}</div>
              <div className="text-xs text-gray-400">Active Voters</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.villages?.length || 0}</div>
              <div className="text-xs text-gray-400">Villages</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{new Date(stats.latest_list_date).toLocaleDateString()}</div>
              <div className="text-xs text-gray-400">List Date</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${stats.removed_voters > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {stats.removed_voters || 0}
              </div>
              <div className="text-xs text-gray-400">Purged</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${stats.transferred_voters > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
                {stats.transferred_voters || 0}
              </div>
              <div className="text-xs text-gray-400">Transfers</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${stats.ambiguous_dob_count > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {stats.ambiguous_dob_count || 0}
              </div>
              <div className="text-xs text-gray-400">Ambiguous DOBs</div>
            </div>
          </div>

          {/* Last import change summary */}
          <ChangeSummary summary={stats.last_change_summary} />
          </>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">No GEC data loaded</p>
              <p className="text-xs text-amber-600 mt-0.5">Upload the GEC voter registration list below to enable auto-vetting.</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-green-500" />
          Upload New GEC List
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Excel File</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm border border-gray-200 rounded-lg p-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Import Type</label>
            <div className="flex gap-3">
              <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${importType === 'full_list' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <input type="radio" name="importType" value="full_list" checked={importType === 'full_list'} onChange={() => setImportType('full_list')} className="sr-only" />
                <Database className="w-4 h-4" />
                <div>
                  <div className="text-sm font-medium">Full Voter List</div>
                  <div className="text-[10px] opacity-70">Detects purges &amp; transfers</div>
                </div>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${importType === 'changes_only' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <input type="radio" name="importType" value="changes_only" checked={importType === 'changes_only'} onChange={() => setImportType('changes_only')} className="sr-only" />
                <RefreshCw className="w-4 h-4" />
                <div>
                  <div className="text-sm font-medium">Changes Only</div>
                  <div className="text-[10px] opacity-70">Adds/updates only, no purge detection</div>
                </div>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">GEC List Date</label>
              <input
                type="date"
                value={listDate}
                onChange={e => setListDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Sheet Name (optional)</label>
              <input
                type="text"
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                placeholder="e.g., Voter List"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || !listDate || uploadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploadMutation.isPending ? 'Uploading...' : 'Upload & Import'}
          </button>
        </div>
      </div>

      {/* Bulk Vet */}
      {stats?.total_voters > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            Re-vet Existing Supporters
          </h2>
          <p className="text-xs text-gray-500 mb-4">Run auto-vetting on all unverified supporters against the current GEC list. Useful after uploading a new list.</p>
          <button
            onClick={() => bulkVetMutation.mutate()}
            disabled={bulkVetMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {bulkVetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {bulkVetMutation.isPending ? 'Vetting...' : 'Bulk Vet Unverified Supporters'}
          </button>
        </div>
      )}

      {/* Import History */}
      {imports?.imports?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            Import History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">File</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Total</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">New</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Updated</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Removed</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Transfers</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Type</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {imports.imports.map((imp: Record<string, unknown>) => (
                  <tr key={imp.id as number} className="border-b border-gray-50">
                    <td className="py-2 px-3 text-gray-600">{new Date(imp.gec_list_date as string).toLocaleDateString()}</td>
                    <td className="py-2 px-3 text-gray-600 text-xs">{imp.filename as string}</td>
                    <td className="py-2 px-3 text-right font-medium">{((imp.total_records as number) || 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-green-600">{imp.new_records as number}</td>
                    <td className="py-2 px-3 text-right text-blue-600">{imp.updated_records as number}</td>
                    <td className="py-2 px-3 text-right text-red-600">{(imp.removed_records as number) || 0}</td>
                    <td className="py-2 px-3 text-right text-blue-600">{(imp.transferred_records as number) || 0}</td>
                    <td className="py-2 px-3">
                      <span className="text-xs text-gray-500">{(imp.import_type as string)?.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        imp.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {imp.status as string}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeSummary({ summary }: { summary?: Record<string, number> }) {
  if (!summary) return null;
  const removed = summary.removed_records || 0;
  const transferred = summary.transferred_records || 0;
  const reVetted = summary.re_vetted_count || 0;
  if (removed + transferred + reVetted === 0) return null;

  return (
    <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
      <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Last Import Changes</div>
      <div className="flex flex-wrap gap-4 text-xs text-blue-800">
        {removed > 0 && <span>Purged: <strong>{removed}</strong></span>}
        {transferred > 0 && <span>Transfers: <strong>{transferred}</strong></span>}
        {reVetted > 0 && <span>Supporters re-flagged: <strong>{reVetted}</strong></span>}
      </div>
    </div>
  );
}
