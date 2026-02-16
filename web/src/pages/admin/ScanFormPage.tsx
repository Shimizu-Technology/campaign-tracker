import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVillages, createSupporter, scanForm, checkDuplicate } from '../../lib/api';
import { DEFAULT_GUAM_PHONE_PREFIX } from '../../lib/phone';
import { Link } from 'react-router-dom';
import {
  Camera, Loader2, Check, AlertTriangle,
  RotateCcw, ImagePlus, ShieldCheck, ShieldAlert, ShieldQuestion,
} from 'lucide-react';

interface Village {
  id: number;
  name: string;
  precincts: { id: number; number: string; alpha_range: string }[];
}

type ScanResult = {
  first_name: string;
  last_name: string;
  contact_number: string;
  email: string;
  dob: string;
  street_address: string;
  village_id: string;
  precinct_id: string;
  registered_voter: boolean;
  yard_sign: boolean;
  motorcade_available: boolean;
  opt_in_email: boolean;
  opt_in_text: boolean;
};

type Confidence = Record<string, 'high' | 'medium' | 'low' | null>;

const emptyForm: ScanResult = {
  first_name: '',
  last_name: '',
  contact_number: DEFAULT_GUAM_PHONE_PREFIX,
  email: '',
  dob: '',
  street_address: '',
  village_id: '',
  precinct_id: '',
  registered_voter: true,
  yard_sign: false,
  motorcade_available: false,
  opt_in_email: false,
  opt_in_text: false,
};

type Phase = 'capture' | 'scanning' | 'review' | 'success';

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' | null | undefined }) {
  if (!level) return null;
  if (level === 'high') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
        <ShieldCheck className="w-3 h-3" /> High
      </span>
    );
  }
  if (level === 'medium') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
        <ShieldQuestion className="w-3 h-3" /> Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
      <ShieldAlert className="w-3 h-3" /> Low
    </span>
  );
}

function confidenceBorder(level: string | null | undefined): string {
  if (level === 'high') return 'border-green-400 bg-green-50';
  if (level === 'medium') return 'border-amber-400 bg-amber-50';
  if (level === 'low') return 'border-red-400 bg-red-50';
  return 'border-[var(--border-soft)]';
}

export default function ScanFormPage() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('capture');
  const [form, setForm] = useState<ScanResult>(emptyForm);
  const [confidence, setConfidence] = useState<Confidence>({});
  const [scanError, setScanError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dupeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (dupeTimerRef.current) clearTimeout(dupeTimerRef.current);
    };
  }, []);

  // Revoke object URL on unmount only (resetForNextScan handles mid-lifecycle cleanup)
  const previewUrlRef = useRef(previewUrl);
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const { data: villageData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });
  const villages: Village[] = useMemo(() => villageData?.villages || [], [villageData]);
  const selectedVillage = villages.find(v => v.id === Number(form.village_id));

  const checkForDuplicate = useCallback((firstName: string, lastName: string, villageId: string) => {
    if (dupeTimerRef.current) clearTimeout(dupeTimerRef.current);
    if (!firstName.trim() || !lastName.trim() || !villageId) return;
    dupeTimerRef.current = setTimeout(async () => {
      try {
        const fullName = `${firstName} ${lastName}`;
        const result = await checkDuplicate(fullName, Number(villageId), firstName, lastName);
        if (result.duplicates?.length > 0) {
          const villageName = villages.find(v => v.id === Number(villageId))?.name || 'this village';
          setDuplicateWarning(`Possible duplicate in ${villageName}`);
        } else {
          setDuplicateWarning('');
        }
      } catch { /* ignore */ }
    }, 500);
  }, [villages]);

  const handleFileSelect = async (file: File) => {
    setPhase('scanning');
    setScanError('');
    setDuplicateWarning('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const result = await scanForm(base64);

      if (result.success && result.extracted) {
        const data = result.extracted;
        const conf: Confidence = result.confidence || {};
        const updates: ScanResult = { ...emptyForm };

        if (data.first_name) updates.first_name = data.first_name;
        if (data.last_name) updates.last_name = data.last_name;
        if (data.print_name && !data.first_name && !data.last_name) {
          const parts = data.print_name.includes(',')
            ? data.print_name.split(',').map((s: string) => s.trim()).reverse()
            : data.print_name.trim().split(/\s+/);
          if (parts.length >= 2) {
            updates.first_name = parts[0];
            updates.last_name = parts.slice(1).join(' ');
          } else {
            updates.last_name = parts[0];
          }
          conf.first_name = conf.first_name || conf.print_name || null;
          conf.last_name = conf.last_name || conf.print_name || null;
        }
        if (data.contact_number) updates.contact_number = data.contact_number;
        if (data.email) updates.email = data.email;
        if (data.dob) updates.dob = data.dob;
        if (data.street_address) updates.street_address = data.street_address;
        if (data.registered_voter != null) updates.registered_voter = data.registered_voter;
        if (data.yard_sign != null) updates.yard_sign = data.yard_sign;
        if (data.motorcade_available != null) updates.motorcade_available = data.motorcade_available;
        if (data.village_id) updates.village_id = String(data.village_id);

        setForm(updates);
        setConfidence(conf);
        setPhase('review');

        // Check duplicate
        if (updates.first_name && updates.last_name && updates.village_id) {
          checkForDuplicate(updates.first_name, updates.last_name, updates.village_id);
        }
      } else {
        setScanError(result.error || 'Could not extract form data');
        setPhase('capture');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setScanError(error?.response?.data?.error || 'Scan failed — try again');
      setPhase('capture');
    }
  };

  const submitMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createSupporter(data, undefined, 'staff'),
    onSuccess: () => {
      setSuccessCount(prev => prev + 1);
      setPhase('success');
      setDuplicateWarning('');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate({
      ...form,
      village_id: Number(form.village_id),
      precinct_id: form.precinct_id ? Number(form.precinct_id) : null,
    });
  };

  const resetForNextScan = () => {
    setForm(emptyForm);
    setConfidence({});
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setScanError('');
    setDuplicateWarning('');
    setPhase('capture');
  };

  const updateField = <K extends keyof ScanResult>(field: K, value: ScanResult[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear confidence when user manually edits (they've verified it)
    setConfidence(prev => ({ ...prev, [field]: null }));
  };

  const inputClass = (field: string) =>
    `w-full px-3 py-3 border-2 rounded-xl text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent transition-colors ${confidenceBorder(confidence[field])}`;

  // Low confidence field count
  const lowConfidenceCount = Object.values(confidence).filter(c => c === 'low').length;
  const medConfidenceCount = Object.values(confidence).filter(c => c === 'medium').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#1B3A6B]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Scan Paper Form</h1>
              <p className="text-gray-500 text-sm">Take a photo → Review → Submit</p>
            </div>
          </div>
          {successCount > 0 && (
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
              {successCount} scanned
            </span>
          )}
        </div>
      </div>

      <div>
        {/* ─── CAPTURE PHASE ─── */}
        {phase === 'capture' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = '';
              }}
            />

            {/* Main camera button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-[var(--surface-raised)] rounded-2xl border-2 border-dashed border-[var(--border-soft)] hover:border-[#1B3A6B] hover:bg-blue-50 transition-all p-12 flex flex-col items-center gap-4"
            >
              <div className="w-20 h-20 rounded-full bg-[#1B3A6B] flex items-center justify-center">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-[var(--text-primary)]">Take a Photo</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Point your camera at the paper signup form</p>
              </div>
            </button>

            {/* Upload option */}
            <button
              onClick={() => {
                // Create a non-capture file input for gallery
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFileSelect(file);
                };
                input.click();
              }}
              className="w-full bg-[var(--surface-raised)] rounded-xl border border-[var(--border-soft)] hover:border-[var(--border-soft)] p-4 flex items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            >
              <ImagePlus className="w-5 h-5" />
              <span className="font-medium">Upload from Gallery</span>
            </button>

            {scanError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" /> {scanError}
              </div>
            )}

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="font-medium text-blue-900 text-sm mb-2">Tips for best results:</p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Place the form on a flat, well-lit surface</li>
                <li>• Capture the entire form in the frame</li>
                <li>• Avoid shadows and glare</li>
                <li>• One form per photo</li>
              </ul>
            </div>

            {/* Manual entry link */}
            <div className="text-center pt-2">
              <Link
                to="/admin/supporters/new"
                className="text-sm text-[#1B3A6B] hover:underline font-medium"
              >
                Or enter manually without scanning →
              </Link>
            </div>
          </div>
        )}

        {/* ─── SCANNING PHASE ─── */}
        {phase === 'scanning' && (
          <div className="space-y-4">
            {previewUrl && (
              <div className="rounded-2xl overflow-hidden border border-[var(--border-soft)]">
                <img src={previewUrl} alt="Scanned form" className="w-full" />
              </div>
            )}
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-12 h-12 text-[#1B3A6B] animate-spin" />
              <p className="text-lg font-medium text-[var(--text-primary)]">Extracting form data...</p>
              <p className="text-sm text-[var(--text-secondary)]">Reading handwriting with AI — this may take a few seconds</p>
            </div>
          </div>
        )}

        {/* ─── REVIEW PHASE ─── */}
        {phase === 'review' && (
          <div className="space-y-4">
            {/* Preview thumbnail + confidence summary */}
            <div className="bg-[var(--surface-raised)] rounded-xl border border-[var(--border-soft)] p-4 flex items-start gap-4">
              {previewUrl && (
                <img src={previewUrl} alt="Scanned form" className="w-20 h-20 object-cover rounded-lg border" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--text-primary)]">Review Extracted Data</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Fields highlighted by confidence. Verify and correct any errors before saving.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lowConfidenceCount > 0 && (
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      {lowConfidenceCount} low confidence
                    </span>
                  )}
                  {medConfidenceCount > 0 && (
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      {medConfidenceCount} needs review
                    </span>
                  )}
                </div>
              </div>
            </div>

            {duplicateWarning && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" /> {duplicateWarning}
              </div>
            )}

            {submitMutation.isError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" /> Error saving. Check required fields and try again.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-[var(--text-primary)]">First Name *</label>
                    <ConfidenceBadge level={confidence.first_name} />
                  </div>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={e => updateField('first_name', e.target.value)}
                    onBlur={() => checkForDuplicate(form.first_name, form.last_name, form.village_id)}
                    className={inputClass('first_name')}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-[var(--text-primary)]">Last Name *</label>
                    <ConfidenceBadge level={confidence.last_name} />
                  </div>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={e => updateField('last_name', e.target.value)}
                    onBlur={() => checkForDuplicate(form.first_name, form.last_name, form.village_id)}
                    className={inputClass('last_name')}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">Phone *</label>
                  <ConfidenceBadge level={confidence.contact_number} />
                </div>
                <input
                  type="tel"
                  required
                  value={form.contact_number}
                  onChange={e => updateField('contact_number', e.target.value)}
                  className={inputClass('contact_number')}
                  placeholder="+1671XXXXXXX"
                />
              </div>

              {/* Village */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">Village *</label>
                  <ConfidenceBadge level={confidence.village} />
                </div>
                <select
                  required
                  value={form.village_id}
                  onChange={e => { updateField('village_id', e.target.value); updateField('precinct_id', ''); }}
                  className={`${inputClass('village')} bg-[var(--surface-raised)]`}
                >
                  <option value="">Select village</option>
                  {villages.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Precinct */}
              {selectedVillage && selectedVillage.precincts.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Precinct</label>
                  <select
                    value={form.precinct_id}
                    onChange={e => updateField('precinct_id', e.target.value)}
                    className="w-full px-3 py-3 border-2 border-[var(--border-soft)] rounded-xl text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent bg-[var(--surface-raised)]"
                  >
                    <option value="">Not sure</option>
                    {selectedVillage.precincts.map(p => (
                      <option key={p.id} value={p.id}>Precinct {p.number} ({p.alpha_range})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">Street Address</label>
                  <ConfidenceBadge level={confidence.street_address} />
                </div>
                <input
                  type="text"
                  value={form.street_address}
                  onChange={e => updateField('street_address', e.target.value)}
                  className={inputClass('street_address')}
                  placeholder="123 Marine Corps Dr"
                />
              </div>

              {/* DOB */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">Date of Birth</label>
                  <ConfidenceBadge level={confidence.dob} />
                </div>
                <input
                  type="date"
                  value={form.dob}
                  onChange={e => updateField('dob', e.target.value)}
                  className={inputClass('dob')}
                />
              </div>

              {/* Email */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">Email</label>
                  <ConfidenceBadge level={confidence.email} />
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  className={inputClass('email')}
                  placeholder="email@example.com"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 py-2">
                <label className="flex items-center gap-3 min-h-[44px]">
                  <input type="checkbox" checked={form.registered_voter} onChange={e => updateField('registered_voter', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
                  <span className="text-[var(--text-primary)]">Registered Voter</span>
                  <ConfidenceBadge level={confidence.registered_voter} />
                </label>
                <label className="flex items-center gap-3 min-h-[44px]">
                  <input type="checkbox" checked={form.yard_sign} onChange={e => updateField('yard_sign', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
                  <span className="text-[var(--text-primary)]">Yard Sign</span>
                  <ConfidenceBadge level={confidence.yard_sign} />
                </label>
                <label className="flex items-center gap-3 min-h-[44px]">
                  <input type="checkbox" checked={form.motorcade_available} onChange={e => updateField('motorcade_available', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
                  <span className="text-[var(--text-primary)]">Available for Motorcade</span>
                  <ConfidenceBadge level={confidence.motorcade_available} />
                </label>
              </div>

              {/* Opt-in */}
              <div className="border-t border-[var(--border-soft)] pt-3 space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">Communication Opt-In</p>
                <label className="flex items-center gap-3 min-h-[44px]">
                  <input type="checkbox" checked={form.opt_in_text} onChange={e => updateField('opt_in_text', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
                  <span className="text-[var(--text-primary)]">Text Updates</span>
                </label>
                <label className="flex items-center gap-3 min-h-[44px]">
                  <input type="checkbox" checked={form.opt_in_email} onChange={e => updateField('opt_in_email', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
                  <span className="text-[var(--text-primary)]">Email Updates</span>
                </label>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="w-full bg-[#C41E3A] hover:bg-[#a01830] text-white font-bold py-4 rounded-xl text-lg shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="w-5 h-5" /> Confirm & Save as Unverified</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForNextScan}
                  className="w-full bg-[var(--surface-overlay)] hover:bg-gray-200 text-[var(--text-primary)] font-semibold py-3 rounded-xl text-lg transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Re-scan
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── SUCCESS PHASE ─── */}
        {phase === 'success' && (
          <div className="text-center py-12 space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Supporter Added!</h2>
              <p className="text-[var(--text-secondary)] mt-2">
                {form.first_name} {form.last_name} has been added as <strong>unverified</strong>.
                An admin will review and verify.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={resetForNextScan}
                className="w-full bg-[#1B3A6B] hover:bg-[#152e55] text-white font-bold py-4 rounded-xl text-lg transition-all flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" /> Scan Next Form
              </button>
              <Link
                to="/admin/vetting"
                className="block w-full bg-[var(--surface-overlay)] hover:bg-gray-200 text-[var(--text-primary)] font-semibold py-3 rounded-xl text-lg transition-all text-center"
              >
                Go to Vetting Queue
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
