import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { uploadImportPreview, parseImportRows, confirmImport, getVillages } from '../../lib/api';
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

// Types
interface SheetInfo {
  name: string;
  index: number;
  row_count: number;
  headers: {
    header_row: number;
    columns: Record<string, number>;
    raw_headers: string[];
  };
  sample_rows: Record<string, string>[];
}

interface PreviewResponse {
  import_key: string;
  filename: string;
  sheets: SheetInfo[];
}

interface ParsedRow {
  _row: number;
  _skip: boolean;
  _issues: string[];
  _duplicate_matches?: { id: number; name: string; phone: string }[];
  first_name?: string;
  last_name?: string;
  contact_number?: string;
  dob?: string;
  email?: string;
  street_address?: string;
  registered_voter?: boolean;
  comments?: string;
}

interface ParseResponse {
  rows: ParsedRow[];
  total: number;
  valid_count: number;
  issue_count: number;
  skip_count: number;
}

interface Village {
  id: number;
  name: string;
}

type Step = 'upload' | 'select-sheet' | 'map-columns' | 'review' | 'complete';

const FIELD_LABELS: Record<string, string> = {
  name: 'Full Name',
  first_name: 'First Name',
  last_name: 'Last Name',
  contact_number: 'Phone Number',
  dob: 'Date of Birth',
  email: 'Email',
  street_address: 'Address',
  registered_voter: 'Registered Voter',
  comments: 'Comments',
  village: 'Village',
};

const IMPORTABLE_FIELDS = ['name', 'first_name', 'last_name', 'contact_number', 'dob', 'email', 'street_address', 'registered_voter', 'village', 'comments'];

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<number>(0);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [parsedData, setParsedData] = useState<ParseResponse | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [villageId, setVillageId] = useState<string>('');
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; errors: string[] }[] } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [reviewError, setReviewError] = useState<string>('');

  const { data: villagesData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });
  const villages: Village[] = villagesData?.villages || villagesData || [];

  // Step 1: Upload
  const uploadMutation = useMutation({
    mutationFn: uploadImportPreview,
    onSuccess: (data: PreviewResponse) => {
      setPreview(data);
      if (data.sheets.length === 1) {
        // Auto-select single sheet
        selectSheet(data.sheets[0], data);
      } else {
        setStep('select-sheet');
      }
    },
  });

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'csv'].includes(ext || '')) {
      setFileError('Please upload an .xlsx or .csv file');
      return;
    }
    setFileError('');
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // Step 2: Select sheet
  const selectSheet = (sheet: SheetInfo, previewData?: PreviewResponse) => {
    const p = previewData || preview;
    setSelectedSheet(sheet.index);
    setColumnMapping(sheet.headers.columns);
    setHeaderRow(sheet.headers.header_row);
    setStep('map-columns');
    // If we have mapping already, we could skip to review
    if (p && Object.keys(sheet.headers.columns).length >= 2) {
      // Good auto-mapping, show it for confirmation
    }
  };

  // Step 3: Column mapping → parse
  const parseMutation = useMutation({
    mutationFn: () => parseImportRows({
      import_key: preview!.import_key,
      sheet_index: selectedSheet,
      column_mapping: { header_row: headerRow, columns: columnMapping },
    }),
    onSuccess: (data: ParseResponse) => {
      setParsedData(data);
      setRows(data.rows);
      setStep('review');
    },
  });

  // Step 4: Confirm import
  const confirmMutation = useMutation({
    mutationFn: () => confirmImport({
      import_key: preview!.import_key,
      village_id: villageId ? Number(villageId) : undefined,
      rows: rows.filter(r => !r._skip),
    }),
    onSuccess: (data) => {
      setImportResult(data);
      setStep('complete');
    },
  });

  const toggleSkip = (rowIndex: number) => {
    setRows(prev => prev.map((r, i) => i === rowIndex ? { ...r, _skip: !r._skip } : r));
  };

  const updateRow = (rowIndex: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIndex ? { ...r, [field]: value } : r));
  };

  const activeRows = rows.filter(r => !r._skip);
  const currentSheet = preview?.sheets.find(s => s.index === selectedSheet);
  const rawHeaders = currentSheet?.headers.raw_headers || [];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-5xl mx-auto">
          <Link to="/admin" className="flex items-center gap-1 text-blue-200 hover:text-white text-sm mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <h1 className="text-xl font-bold">Import Supporters</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-blue-200">
            {(['upload', 'select-sheet', 'map-columns', 'review', 'complete'] as Step[]).map((s, i) => (
              <span key={s} className={`flex items-center gap-1 ${step === s ? 'text-white font-medium' : ''}`}>
                {i > 0 && <span className="mx-1">→</span>}
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${
                  step === s ? 'bg-[var(--surface-raised)] text-[#1B3A6B]' : 'bg-white/20'
                }`}>{i + 1}</span>
                {s === 'upload' ? 'Upload' : s === 'select-sheet' ? 'Sheet' : s === 'map-columns' ? 'Columns' : s === 'review' ? 'Review' : 'Done'}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
                dragActive ? 'border-[#1B3A6B] bg-blue-500/10' : 'border-[var(--border-soft)] bg-[var(--surface-raised)]'
              }`}
            >
              {uploadMutation.isPending ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-[#1B3A6B] animate-spin" />
                  <p className="text-[var(--text-secondary)]">Parsing spreadsheet...</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                  <p className="text-lg font-medium text-[var(--text-primary)] mb-2">Drop your spreadsheet here</p>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">Supports .xlsx and .csv files</p>
                  <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#15305a] cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Choose File
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </label>
                </>
              )}
            </div>
            {(uploadMutation.isError || fileError) && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
                {fileError || (uploadMutation.error as Error)?.message || 'Failed to parse file. Please check the format.'}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Sheet */}
        {step === 'select-sheet' && preview && (
          <div className="space-y-4">
            <div className="app-card p-4">
              <h2 className="font-semibold text-[var(--text-primary)] mb-1">Select a Sheet</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                <strong>{preview.filename}</strong> has {preview.sheets.length} sheets with data. Choose which one to import.
              </p>
              <div className="space-y-3">
                {preview.sheets.map((sheet) => (
                  <button
                    key={sheet.index}
                    onClick={() => selectSheet(sheet)}
                    className="w-full text-left p-4 border border-[var(--border-soft)] rounded-xl hover:border-[#1B3A6B] hover:bg-blue-500/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{sheet.name}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{sheet.row_count} rows · {Object.keys(sheet.headers.columns).length} columns detected</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-[var(--text-muted)]" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep('upload')} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <ArrowLeft className="w-4 h-4" /> Back to upload
            </button>
          </div>
        )}

        {/* Step 3: Column Mapping */}
        {step === 'map-columns' && currentSheet && (
          <div className="space-y-4">
            <div className="app-card p-4">
              <h2 className="font-semibold text-[var(--text-primary)] mb-1">Map Columns</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                We auto-detected column mappings from <strong>{currentSheet.name}</strong>. Adjust if needed.
              </p>
              <div className="space-y-3">
                {IMPORTABLE_FIELDS.map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <label className="w-40 text-sm font-medium text-[var(--text-primary)] text-right">
                      {FIELD_LABELS[field]}
                      {(field === 'name' || field === 'first_name') && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping(prev => ({
                        ...prev,
                        [field]: e.target.value ? Number(e.target.value) : 0
                      }))}
                      className="flex-1 rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-sm"
                    >
                      <option value="">— Skip —</option>
                      {rawHeaders.map((h, i) => (
                        <option key={i} value={i + 1}>
                          Column {i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`}: {h || `(column ${i + 1})`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Preview */}
            {currentSheet && currentSheet.sample_rows.length > 0 && (
              <div className="app-card p-4">
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">Preview (first {currentSheet.sample_rows.length} rows)</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-3">Verify your column mappings look correct before parsing all rows.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-[var(--text-secondary)] uppercase">
                        {IMPORTABLE_FIELDS.filter(f => columnMapping[f]).map(f => (
                          <th key={f} className="px-2 py-1">{FIELD_LABELS[f]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentSheet.sample_rows.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--border-subtle)]">
                          {IMPORTABLE_FIELDS.filter(f => columnMapping[f]).map(f => (
                            <td key={f} className="px-2 py-1.5 text-[var(--text-primary)] max-w-[150px] truncate">
                              {row[f] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Village Selection — only when no village column is mapped */}
            {!columnMapping.village ? (
              <div className="app-card p-4">
                <h2 className="font-semibold text-[var(--text-primary)] mb-1">Assign Village</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  All imported supporters will be assigned to this village. Or map a "Village" column above to assign per-row.
                </p>
                <select
                  value={villageId}
                  onChange={(e) => setVillageId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm"
                >
                  <option value="">Select a village...</option>
                  {villages.map((v: Village) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm text-blue-300">
                Village will be assigned per-row from the <strong>Village</strong> column in your spreadsheet.
                Rows with unrecognized village names will be flagged as errors.
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => preview!.sheets.length > 1 ? setStep('select-sheet') : setStep('upload')}
                className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => parseMutation.mutate()}
                disabled={parseMutation.isPending || (!villageId && !columnMapping.village) || (!columnMapping.name && !columnMapping.first_name)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#15305a] disabled:opacity-50"
              >
                {parseMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Parse & Preview</>
                )}
              </button>
            </div>
            {parseMutation.isError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
                {(parseMutation.error as Error)?.message || 'Failed to parse the spreadsheet. Please check the file and try again.'}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && parsedData && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="app-card p-4">
              <h2 className="font-semibold text-[var(--text-primary)] mb-2">Review Import Data</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-[var(--surface-bg)] rounded-lg p-3">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{rows.length}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Total Rows</p>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">{activeRows.filter(r => r._issues.length === 0).length}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Ready</p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <p className="text-2xl font-bold text-amber-600">{activeRows.filter(r => r._issues.length > 0).length}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Has Issues</p>
                </div>
                <div className="bg-[var(--surface-overlay)] rounded-lg p-3">
                  <p className="text-2xl font-bold text-[var(--text-muted)]">{rows.filter(r => r._skip).length}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Skipped</p>
                </div>
              </div>
            </div>

            {/* Village reminder */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm text-blue-300">
              {columnMapping.village
                ? <>Village assigned <strong>per-row</strong> from spreadsheet column</>
                : <>Importing into <strong>{villages.find(v => v.id === Number(villageId))?.name}</strong></>
              } · All records will be <strong>unverified</strong> until staff reviews them.
            </div>

            {/* Row table */}
            <div className="app-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-soft)] text-left text-xs text-[var(--text-secondary)] uppercase">
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">DOB</th>
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2">Reg?</th>
                    {columnMapping.village && <th className="px-3 py-2">Village</th>}
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 w-16">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className={`border-b border-[var(--border-subtle)] ${row._skip ? 'opacity-40 bg-[var(--surface-bg)]' : row._issues.length > 0 ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{row._row}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            className="font-medium text-[var(--text-primary)] bg-transparent border-b border-transparent hover:border-[var(--border-soft)] focus:border-[#1B3A6B] focus:outline-none w-16 px-0"
                            value={row.first_name || ''}
                            onChange={(e) => updateRow(idx, 'first_name', e.target.value)}
                            placeholder="First"
                            disabled={row._skip}
                          />
                          <input
                            className="font-medium text-[var(--text-primary)] bg-transparent border-b border-transparent hover:border-[var(--border-soft)] focus:border-[#1B3A6B] focus:outline-none w-20 px-0"
                            value={row.last_name || ''}
                            onChange={(e) => updateRow(idx, 'last_name', e.target.value)}
                            placeholder="Last"
                            disabled={row._skip}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{row.contact_number}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{row.dob || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[200px] truncate" title={row.street_address}>{row.street_address || '—'}</td>
                      <td className="px-3 py-2">
                        {row.registered_voter === true ? (
                          <span className="text-green-600 font-medium">Y</span>
                        ) : row.registered_voter === false ? (
                          <span className="text-red-500">N</span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      {columnMapping.village && (
                        <td className="px-3 py-2 text-[var(--text-secondary)] text-xs">{(row as Record<string, unknown>).village as string || '—'}</td>
                      )}
                      <td className="px-3 py-2">
                        {row._skip ? (
                          <span className="text-xs text-[var(--text-muted)]">Skipped</span>
                        ) : row._issues.length > 0 ? (
                          <div className="flex items-start gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-600">
                              {row._issues.map((issue, i) => <p key={i}>{issue}</p>)}
                            </div>
                          </div>
                        ) : (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleSkip(idx)}
                          className={`text-xs px-2 py-1 rounded ${
                            row._skip
                              ? 'bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:bg-[var(--border-soft)]'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        >
                          {row._skip ? 'Include' : 'Skip'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {confirmMutation.isError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
                {(confirmMutation.error as Error)?.message || 'Import failed. Please try again.'}
              </div>
            )}
            <div className="flex items-center justify-between">
              <button onClick={() => setStep('map-columns')} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <ArrowLeft className="w-4 h-4" /> Back to mapping
              </button>
              <div className="flex items-center gap-3">
                {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
                <button
                  onClick={() => {
                    if (activeRows.length === 0) {
                      setReviewError('No rows to import. Un-skip some rows first.');
                      return;
                    }
                    setReviewError('');
                    setShowConfirm(true);
                  }}
                  disabled={confirmMutation.isPending || activeRows.length === 0}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {confirmMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                  ) : (
                    <><Check className="w-4 h-4" /> Import {activeRows.length} Supporters</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && importResult && (
          <div className="app-card p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Import Complete!</h2>
            <p className="text-[var(--text-secondary)] mb-6">
              <strong>{importResult.created}</strong> supporters imported into <strong>{importResult.village}</strong>
              {importResult.skipped > 0 && <> · {importResult.skipped} skipped due to errors</>}
            </p>
            {importResult.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
                <p className="font-medium text-red-300 mb-2">Errors:</p>
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-sm text-red-600">Row {err.row}: {err.errors.join(', ')}</p>
                ))}
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setStep('upload');
                  setPreview(null);
                  setParsedData(null);
                  setRows([]);
                  setImportResult(null);
                }}
                className="px-6 py-2.5 border border-[var(--border-soft)] rounded-lg hover:bg-[var(--surface-bg)] text-[var(--text-primary)]"
              >
                Import More
              </button>
              <a
                href="/admin/supporters"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#15305a]"
              >
                View Supporters
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-raised)] rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Confirm Import</h3>
            <p className="text-[var(--text-secondary)] mb-4">
              Import <strong>{activeRows.length}</strong> supporters
              {columnMapping.village
                ? <> across <strong>multiple villages</strong> (from spreadsheet)?</>
                : <> into <strong>{villages.find(v => v.id === Number(villageId))?.name}</strong>?</>
              }
            </p>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              All records will be marked as <strong>unverified</strong> until staff reviews them.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-[var(--border-soft)] rounded-lg hover:bg-[var(--surface-bg)] text-[var(--text-primary)] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); confirmMutation.mutate(); }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                Yes, Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
