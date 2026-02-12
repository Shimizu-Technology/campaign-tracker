import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVillages, createSupporter, scanForm } from '../../lib/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, AlertTriangle, Loader2, Camera, ScanLine } from 'lucide-react';

interface Village {
  id: number;
  name: string;
  precincts: { id: number; number: string; alpha_range: string }[];
}

const emptyForm = {
  print_name: '',
  contact_number: '',
  email: '',
  dob: '',
  street_address: '',
  village_id: '',
  precinct_id: '',
  registered_voter: true,
  yard_sign: false,
  motorcade_available: false,
};

export default function StaffEntryPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [lastVillage, setLastVillage] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // OCR Scanner
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedFields, setScannedFields] = useState<Set<string>>(new Set());

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
        const data = result.extracted;
        const filled = new Set<string>();

        // Auto-fill form with extracted data
        const updates: any = { ...emptyForm };
        if (data.print_name) { updates.print_name = data.print_name; filled.add('print_name'); }
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
      } else {
        setScanError(result.error || 'Could not extract form data');
      }
    } catch (err: any) {
      setScanError(err?.response?.data?.error || 'Scan failed — try again');
    } finally {
      setScanning(false);
    }
  };

  const { data: villageData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });
  const villages: Village[] = villageData?.villages || [];
  const selectedVillage = villages.find(v => v.id === Number(form.village_id));

  const submit = useMutation({
    mutationFn: (data: any) => createSupporter(data),
    onSuccess: () => {
      setSuccessCount(prev => prev + 1);
      setShowSuccess(true);
      setLastVillage(form.village_id);
      // Reset form but keep village for bulk entry
      setForm({
        ...emptyForm,
        village_id: form.village_id,
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTimeout(() => setShowSuccess(false), 2000);
      // Focus name field for next entry
      document.getElementById('print_name')?.focus();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit.mutate({
      ...form,
      village_id: Number(form.village_id),
      precinct_id: form.precinct_id ? Number(form.precinct_id) : null,
    });
  };

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear scan highlight when user edits
    setScannedFields(prev => { const next = new Set(prev); next.delete(field); return next; });
  };

  const inputClass = (field: string) =>
    `w-full px-3 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent ${
      scannedFields.has(field) ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-lg mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Staff Entry Form</h1>
            <div className="flex items-center gap-2">
              {successCount > 0 && (
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
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
                className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-all"
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
      </header>

      {/* Scan Results */}
      {scannedFields.size > 0 && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            <span>Scanned {scannedFields.size} fields — <strong>review and confirm</strong> before saving</span>
          </div>
        </div>
      )}
      {scanError && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> {scanError}
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5" /> Supporter added! Ready for next entry.
          </div>
        </div>
      )}

      {/* Duplicate Warning */}
      {submit.isError && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Error saving. Check all fields and try again.
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Village (sticky for bulk entry) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Village *</label>
          <select
            required
            value={form.village_id}
            onChange={e => updateField('village_id', e.target.value)}
            className={`${inputClass('village_id')} bg-white`}
          >
            <option value="">Select village</option>
            {villages.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            id="print_name"
            type="text"
            required
            autoFocus
            value={form.print_name}
            onChange={e => updateField('print_name', e.target.value)}
            className={inputClass("print_name")}
            placeholder="Print Name"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
          <input
            type="tel"
            required
            value={form.contact_number}
            onChange={e => updateField('contact_number', e.target.value)}
            className={inputClass("contact_number")}
            placeholder="671-555-1234"
          />
        </div>

        {/* DOB */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
          <input
            type="date"
            value={form.dob}
            onChange={e => updateField('dob', e.target.value)}
            className={inputClass("dob")}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
          <input
            type="text"
            value={form.street_address}
            onChange={e => updateField('street_address', e.target.value)}
            className={inputClass("street_address")}
            placeholder="123 Marine Corps Dr"
          />
        </div>

        {/* Precinct */}
        {selectedVillage && selectedVillage.precincts.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precinct</label>
            <select
              value={form.precinct_id}
              onChange={e => updateField('precinct_id', e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent bg-white"
            >
              <option value="">Not sure</option>
              {selectedVillage.precincts.map(p => (
                <option key={p.id} value={p.id}>Precinct {p.number} ({p.alpha_range})</option>
              ))}
            </select>
          </div>
        )}

        {/* Checkboxes */}
        <div className="space-y-3 py-2">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.registered_voter} onChange={e => updateField('registered_voter', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
            <span className="text-gray-700">Registered Voter</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.yard_sign} onChange={e => updateField('yard_sign', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
            <span className="text-gray-700">Yard Sign</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.motorcade_available} onChange={e => updateField('motorcade_available', e.target.checked)} className="w-5 h-5 rounded text-[#1B3A6B]" />
            <span className="text-gray-700">Available for Motorcade</span>
          </label>
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
