import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVillages, createSupporter, scanForm, checkDuplicate } from '../../lib/api';
import { useSession } from '../../hooks/useSession';
import { Check, AlertTriangle, Loader2, Camera, ScanLine } from 'lucide-react';

interface Village {
  id: number;
  name: string;
}

type StaffForm = {
  first_name: string;
  last_name: string;
  contact_number: string;
  email: string;
  dob: string;
  street_address: string;
  village_id: string;
  registered_voter: boolean;
  yard_sign: boolean;
  motorcade_available: boolean;
  opt_in_email: boolean;
  opt_in_text: boolean;
};

type ExtractedScanData = Partial<{
  first_name: string;
  last_name: string;
  print_name: string;
  contact_number: string;
  email: string;
  dob: string;
  street_address: string;
  village_id: number | string;
  registered_voter: boolean;
  yard_sign: boolean;
  motorcade_available: boolean;
}>;

const emptyForm = {
  first_name: '',
  last_name: '',
  contact_number: '',
  email: '',
  dob: '',
  street_address: '',
  village_id: '',
  registered_voter: true,
  yard_sign: false,
  motorcade_available: false,
  opt_in_email: false,
  opt_in_text: false,
};

export default function StaffEntryPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [successCount, setSuccessCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: villageData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });
  const { data: sessionData } = useSession();
  const scopedVillageIds = sessionData?.user?.scoped_village_ids ?? null;
  const villages: Village[] = useMemo(() => {
    const all = villageData?.villages || [];
    if (!scopedVillageIds) return all;
    return all.filter((v: Village) => scopedVillageIds.includes(v.id));
  }, [villageData, scopedVillageIds]);
  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const dupeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const checkForDuplicate = useCallback((name: string, villageId: string, firstName?: string, lastName?: string) => {
    if (dupeTimerRef.current) clearTimeout(dupeTimerRef.current);
    if (!name.trim() || !villageId) return;
    dupeTimerRef.current = setTimeout(async () => {
      try {
        const result = await checkDuplicate(name.trim(), Number(villageId), firstName, lastName);
        if (result.duplicates && result.duplicates.length > 0) {
          const villageName = villages.find(v => v.id === Number(villageId))?.name || 'this village';
          setDuplicateWarning(`A supporter with this name already exists in ${villageName}`);
        } else {
          setDuplicateWarning('');
        }
      } catch {
        // silently ignore
      }
    }, 500);
  }, [villages]);

  // OCR Scanner
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedFields, setScannedFields] = useState<Set<string>>(new Set());
  const [scanAssistedEntry, setScanAssistedEntry] = useState(false);

  const handleScan = async (file: File) => {
    setScanning(true);
    setScanError('');
    setScannedFields(new Set());

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const result = await scanForm(base64);

      if (result.success && result.extracted) {
        const data = result.extracted as ExtractedScanData;
        const filled = new Set<string>();

        // Auto-fill form with extracted data
        const updates: StaffForm = { ...emptyForm };
        if (data.first_name) { updates.first_name = data.first_name; filled.add('first_name'); }
        if (data.last_name) { updates.last_name = data.last_name; filled.add('last_name'); }
        // Legacy: if OCR returns print_name but not first/last, try to split
        if (data.print_name && !data.first_name && !data.last_name) {
          const parts = data.print_name.includes(',')
            ? data.print_name.split(',').map(s => s.trim()).reverse()
            : data.print_name.trim().split(/\s+/);
          if (parts.length >= 2) {
            updates.first_name = parts[0];
            updates.last_name = parts.slice(1).join(' ');
          } else {
            updates.last_name = parts[0];
          }
          filled.add('first_name');
          filled.add('last_name');
        }
        if (data.contact_number) { updates.contact_number = data.contact_number; filled.add('contact_number'); }
        if (data.email) { updates.email = data.email; filled.add('email'); }
        if (data.dob) { updates.dob = data.dob; filled.add('dob'); }
        if (data.street_address) { updates.street_address = data.street_address; filled.add('street_address'); }
        if (data.registered_voter != null) { updates.registered_voter = data.registered_voter; filled.add('registered_voter'); }
        if (data.yard_sign != null) { updates.yard_sign = data.yard_sign; filled.add('yard_sign'); }
        if (data.motorcade_available != null) { updates.motorcade_available = data.motorcade_available; filled.add('motorcade_available'); }

        // Match village
        if (data.village_id) {
          updates.village_id = String(data.village_id);
          filled.add('village_id');
        }

        setForm(updates);
        setScannedFields(filled);
        setScanAssistedEntry(true);
      } else {
        setScanError(result.error || 'Could not extract form data');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setScanError(error?.response?.data?.error || 'Scan failed — try again');
    } finally {
      setScanning(false);
    }
  };

  const submit = useMutation({
    mutationFn: (data: Record<string, unknown>) => createSupporter(data, undefined, 'staff', scanAssistedEntry ? 'scan' : 'manual'),
    onSuccess: () => {
      setSuccessCount(prev => prev + 1);
      setShowSuccess(true);
      setDuplicateWarning('');
      // Reset form but keep village for bulk entry
      setForm({
        ...emptyForm,
        village_id: form.village_id,
      });
      setScannedFields(new Set());
      setScanAssistedEntry(false);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTimeout(() => setShowSuccess(false), 2000);
      // Focus name field for next entry
      document.getElementById('first_name')?.focus();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit.mutate({
      ...form,
      contact_number: form.contact_number.trim() || null,
      village_id: Number(form.village_id),
    });
  };

  const updateField = <K extends keyof StaffForm>(field: K, value: StaffForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear scan highlight when user edits
    setScannedFields(prev => { const next = new Set(prev); next.delete(field); return next; });
  };

  const inputClass = (field: string) =>
    `w-full px-3 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent ${
      scannedFields.has(field) ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-[var(--border-soft)]'
    }`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Staff Entry Form</h1>
          <div className="flex items-center gap-2">
            {successCount > 0 && (
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                {successCount} entered
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScan(file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-all"
            >
              {scanning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
              ) : (
                <><Camera className="w-4 h-4" /> Scan Form</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Scan Results */}
      {scannedFields.size > 0 && (
        <div>
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            <span>Scanned {scannedFields.size} fields — <strong>review and confirm</strong> before saving</span>
          </div>
        </div>
      )}
      {scanError && (
        <div className="mt-4">
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> {scanError}
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="mt-4">
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5" /> Supporter added! Ready for next entry.
          </div>
        </div>
      )}

      {/* Duplicate Warning */}
      {duplicateWarning && (
        <div className="mt-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {duplicateWarning}
          </div>
        </div>
      )}

      {/* Submit Error */}
      {submit.isError && (
        <div className="mt-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Error saving. Check all fields and try again.
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Village (sticky for bulk entry) */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Village *</label>
          <select
            required
            value={form.village_id}
            onChange={e => updateField('village_id', e.target.value)}
            className={`${inputClass('village_id')} bg-[var(--surface-raised)]`}
          >
            <option value="">Select village</option>
            {villages.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">First Name *</label>
            <input
              id="first_name"
              type="text"
              required
              autoFocus
              value={form.first_name}
              onChange={e => updateField('first_name', e.target.value)}
              className={inputClass("first_name")}
              placeholder="First Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Last Name *</label>
            <input
              id="last_name"
              type="text"
              required
              value={form.last_name}
              onChange={e => updateField('last_name', e.target.value)}
              onBlur={() => checkForDuplicate(`${form.first_name} ${form.last_name}`, form.village_id, form.first_name, form.last_name)}
              className={inputClass("last_name")}
              placeholder="Last Name"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Contact Number (optional)</label>
          <input
            type="tel"
            value={form.contact_number}
            onChange={e => updateField('contact_number', e.target.value)}
            className={inputClass("contact_number")}
            placeholder="+1671XXXXXXX"
          />
        </div>

        {/* DOB */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Date of Birth</label>
          <input
            type="date"
            value={form.dob}
            onChange={e => updateField('dob', e.target.value)}
            className={inputClass("dob")}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => updateField('email', e.target.value)}
            className={inputClass("email")}
            placeholder="email@example.com"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Street Address</label>
          <input
            type="text"
            value={form.street_address}
            onChange={e => updateField('street_address', e.target.value)}
            className={inputClass("street_address")}
            placeholder="123 Marine Corps Dr"
          />
        </div>

        {/* Checkboxes */}
        <div className="space-y-3 py-2">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.registered_voter} onChange={e => updateField('registered_voter', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
            <span className="text-[var(--text-primary)]">Registered Voter</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.yard_sign} onChange={e => updateField('yard_sign', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
            <span className="text-[var(--text-primary)]">Yard Sign</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.motorcade_available} onChange={e => updateField('motorcade_available', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
            <span className="text-[var(--text-primary)]">Available for Motorcade</span>
          </label>
        </div>

        {/* Communication Opt-In */}
        <div className="border-t border-[var(--border-soft)] pt-3 space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">Communication Opt-In</p>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.opt_in_text} onChange={e => updateField('opt_in_text', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
            <span className="text-[var(--text-primary)]">Text Updates</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.opt_in_email} onChange={e => updateField('opt_in_email', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
            <span className="text-[var(--text-primary)]">Email Updates</span>
          </label>
          <p className="text-xs text-[var(--text-muted)]">Supporter consents to receive campaign communications.</p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submit.isPending}
          className="w-full bg-[#C41E3A] hover:bg-[#a01830] text-white font-bold py-4 rounded-xl text-lg shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submit.isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
          ) : (
            'Save & Next Entry'
          )}
        </button>
      </form>
    </div>
  );
}
