import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGecStats, getGecImports, uploadGecList, bulkVetSupporters, previewGecList } from '../../lib/api';
import {
  Database,
  Upload,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
} from 'lucide-react';

type PdfQaStatus = 'pass' | 'review' | 'fail';

type PreviewRow = Record<string, unknown>;

interface PdfPreviewData {
  source_type: 'pdf';
  qa: { status: PdfQaStatus; quality_score: number; row_count: number };
  warnings: string[];
  row_count: number;
  parse_cache_key: string | null;
  preview_rows: PreviewRow[];
}

interface SpreadsheetPreviewData {
  source_type: 'spreadsheet';
  sheets: string[];
  headers: Record<string, string>;
  column_map: Record<string, string>;
  row_count: number;
  preview_rows: PreviewRow[];
}

type PreviewData = PdfPreviewData | SpreadsheetPreviewData;

export default function TeamGecPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [listDate, setListDate] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [importType, setImportType] = useState<'full_list' | 'changes_only'>('full_list');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmReview, setConfirmReview] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['gec-stats'], queryFn: getGecStats });
  const { data: imports } = useQuery({
    queryKey: ['gec-imports'],
    queryFn: getGecImports,
    refetchInterval: (query) => {
      const data = query.state.data as { imports?: Array<Record<string, unknown>> } | undefined;
      const rows = Array.isArray(data?.imports) ? data.imports : [];
      return rows.some((r) => r.status === 'processing' || r.status === 'pending') ? 3000 : false;
    }
  });

  const isPdfPreview = previewData?.source_type === 'pdf';
  const pdfStatus = isPdfPreview ? previewData.qa?.status : null;
  const reviewNeedsConfirmation = pdfStatus === 'review' && !confirmReview;
  const activeImport = imports?.imports?.find((imp: Record<string, unknown>) => imp.status === 'processing' || imp.status === 'pending');
  const hasActiveImport = Boolean(activeImport);
  const activeProgress = Number((activeImport?.metadata as Record<string, unknown> | undefined)?.progress_percent || 0);
  const activeProgressDisplay = Math.max(5, Math.min(100, activeProgress));
  const activeStage = String((activeImport?.metadata as Record<string, unknown> | undefined)?.stage || 'processing');

  const previouslyHadActiveImport = useRef(false);
  useEffect(() => {
    if (previouslyHadActiveImport.current && !hasActiveImport) {
      queryClient.invalidateQueries({ queryKey: ['gec-stats'] });
    }
    previouslyHadActiveImport.current = hasActiveImport;
  }, [hasActiveImport, queryClient]);

  const previewMutation = useMutation({
    mutationFn: () => previewGecList(file!, sheetName || undefined),
    onMutate: () => {
      setPreviewData(null);
      setConfirmReview(false);
      setErrorMessage(null);
      setSuccessMessage(null);
    },
    onSuccess: (data: PreviewData) => setPreviewData(data),
    onError: (err: Error) => setErrorMessage(`Preview failed: ${err.message}`),
  });

  const uploadMutation = useMutation({
    mutationFn: () => uploadGecList(
      file!,
      listDate,
      sheetName || undefined,
      importType,
      isPdfPreview ? previewData.parse_cache_key || undefined : undefined,
      confirmReview,
      true
    ),
    onSuccess: (data) => {
      setFile(null);
      setListDate('');
      setSheetName('');
      setImportType('full_list');
      setPreviewData(null);
      setConfirmReview(false);
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['gec-imports'] });

      if (data?.async) {
        const importId = data?.import?.id;
        setSuccessMessage(`Import queued in background${importId ? ` (ID #${importId})` : ''}. You can leave this page — progress will continue and update in Import History.`);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['gec-stats'] });
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
      setSuccessMessage(lines.join('\n'));
    },
    onError: (err: Error) => setErrorMessage(`Import failed: ${err.message}`),
  });

  const bulkVetMutation = useMutation({
    mutationFn: () => bulkVetSupporters({ unverified_only: 'true' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vetting-queue'] });
      setErrorMessage(null);
      setSuccessMessage(`Bulk vetting complete!\n\nAuto-verified: ${data.results.auto_verified}\nFlagged: ${data.results.flagged}\nReferrals: ${data.results.referral}\nUnregistered: ${data.results.unregistered}`);
    },
    onError: (err: Error) => setErrorMessage(`Bulk vetting failed: ${err.message}`),
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

      {activeImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-sm font-semibold text-blue-900">Background import in progress</div>
            <div className="text-xs text-blue-700 capitalize">{activeStage.replace(/_/g, ' ')}</div>
          </div>
          <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${activeProgressDisplay}%` }} />
          </div>
          <div className="mt-2 text-xs text-blue-700">
            {activeProgressDisplay}% complete — safe to leave this page. Progress updates automatically.
          </div>
        </div>
      )}

      {/* Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-green-500" />
          Upload New GEC List
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Excel / PDF File</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={e => {
                setFile(e.target.files?.[0] || null);
                setPreviewData(null);
                setConfirmReview(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => previewMutation.mutate()}
              disabled={!file || previewMutation.isPending || uploadMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {previewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {previewMutation.isPending ? 'Analyzing...' : 'Analyze File'}
            </button>
            <button
              onClick={() => uploadMutation.mutate()}
              disabled={!file || !listDate || uploadMutation.isPending || pdfStatus === 'fail' || reviewNeedsConfirmation}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadMutation.isPending ? 'Uploading...' : 'Upload & Import'}
            </button>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-line">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 whitespace-pre-line">
              {successMessage}
            </div>
          )}

          {previewData && (
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-3">
              {previewData.source_type === 'pdf' ? (
                <>
                  <div className="space-y-2 text-sm">
                    <div className="font-semibold text-gray-800">PDF QA Summary</div>
                    <div className="text-gray-700">Rows parsed: <strong>{Number(previewData.row_count || 0).toLocaleString()}</strong></div>
                    <div className="text-gray-700">Quality score: <strong>{previewData.qa?.quality_score ?? 'n/a'}</strong></div>
                    <div className="text-gray-700">Status: <strong className={`uppercase ${
                      previewData.qa?.status === 'fail'
                        ? 'text-red-600'
                        : previewData.qa?.status === 'review'
                        ? 'text-amber-600'
                        : 'text-green-600'
                    }`}>{previewData.qa?.status ?? 'unknown'}</strong></div>

                    {previewData.qa?.status === 'review' && (
                      <label className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-2">
                        <input
                          type="checkbox"
                          checked={confirmReview}
                          onChange={e => setConfirmReview(e.target.checked)}
                        />
                        I reviewed this PDF preview and want to proceed with import.
                      </label>
                    )}

                    {previewData.warnings.length > 0 && (
                      <ul className="list-disc pl-5 text-amber-700 text-xs">
                        {previewData.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    )}
                  </div>
                  {previewData.preview_rows.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Sample Rows (first {previewData.preview_rows.length})</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left px-2 py-1 text-gray-500 font-medium">Reg No.</th>
                              <th className="text-left px-2 py-1 text-gray-500 font-medium">Name</th>
                              <th className="text-left px-2 py-1 text-gray-500 font-medium">Village</th>
                              <th className="text-left px-2 py-1 text-gray-500 font-medium">Birth Year</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.preview_rows.map((row, i) => (
                              <tr key={i} className="border-t border-gray-200">
                                <td className="px-2 py-1 text-gray-600">{String(row.voter_registration_number ?? '')}</td>
                                <td className="px-2 py-1 text-gray-800">{String(row.name ?? '')}</td>
                                <td className="px-2 py-1 text-gray-600">{String(row.village ?? '')}</td>
                                <td className="px-2 py-1 text-gray-600">{String(row.birth_year ?? '')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-700">
                  Spreadsheet preview ready. Rows detected: <strong>{Number(previewData.row_count || 0).toLocaleString()}</strong>
                </div>
              )}
            </div>
          )}
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
                        imp.status === 'completed'
                          ? 'bg-green-50 text-green-700'
                          : (imp.status === 'processing' || imp.status === 'pending')
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
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
