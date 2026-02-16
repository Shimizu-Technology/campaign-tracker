import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { QrCode, Copy, Check, Download } from 'lucide-react';
import api, { getVillages } from '../../lib/api';

interface QRResult {
  code: string;
  signup_url: string;
  qr_svg_url: string;
}

interface Village {
  id: number;
  name: string;
}

export default function QRCodePage() {
  const apiOrigin = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  const [name, setName] = useState('');
  const [villageId, setVillageId] = useState('');
  const [generated, setGenerated] = useState<QRResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: villageData } = useQuery({ queryKey: ['villages'], queryFn: getVillages });
  const villages: Village[] = useMemo(() => villageData?.villages || [], [villageData]);
  const selectedVillage = useMemo(
    () => villages.find(v => v.id === Number(villageId)),
    [villages, villageId]
  );

  const generate = useMutation({
    mutationFn: () => api.post('/qr_codes/generate', { name, village: selectedVillage?.name || '' }).then(r => r.data),
    onSuccess: (data) => setGenerated(data),
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generate.mutate();
  };

  const copyLink = () => {
    if (generated) {
      navigator.clipboard.writeText(generated.signup_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const qrSvgUrl = generated
    ? (generated.qr_svg_url.startsWith('http')
      ? generated.qr_svg_url
      : (apiOrigin ? `${apiOrigin}${generated.qr_svg_url}` : generated.qr_svg_url))
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">QR Code Generator</h1>
            <p className="text-gray-500 text-sm">Generate unique QR codes for block leaders</p>
          </div>
        </div>
      </div>

      <div>
        {/* Generator Form */}
        <form onSubmit={handleGenerate} className="app-card p-6 mb-6">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Generate New QR Code</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Block Leader Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Pedro Reyes"
                className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-xl focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Village</label>
              <select
                required
                value={villageId}
                onChange={e => setVillageId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-xl focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent bg-[var(--surface-raised)]"
              >
                <option value="">Select a village...</option>
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={generate.isPending || !name || !villageId}
              className="w-full bg-[#1B3A6B] hover:bg-[#152e55] text-white font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {generate.isPending ? 'Generating...' : 'Generate QR Code'}
            </button>
          </div>
        </form>

        {/* Generated QR */}
        {generated && (
          <div className="app-card p-6 text-center">
            <h2 className="font-semibold text-[var(--text-primary)] mb-2">QR Code for {name}</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Village: {selectedVillage?.name} · Code: {generated.code}</p>

            {/* QR Image */}
            <div className="flex justify-center mb-6">
              <img
                src={qrSvgUrl!}
                alt={`QR Code for ${name}`}
                className="w-64 h-64 border rounded-xl p-2"
              />
            </div>

            {/* Signup URL */}
            <div className="bg-[var(--surface-bg)] rounded-xl p-3 mb-4">
              <p className="text-xs text-[var(--text-secondary)] mb-1">Signup Link</p>
              <p className="text-sm text-[#1B3A6B] font-mono break-all">{generated.signup_url}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 border border-[var(--border-soft)] rounded-xl py-2 px-4 hover:bg-[var(--surface-bg)] text-sm font-medium"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={qrSvgUrl!}
                download={`qr-${generated.code}.svg`}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1B3A6B] text-white rounded-xl py-2 px-4 hover:bg-[#152e55] text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Download SVG
              </a>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-4">
              Print this QR code on flyers or display on your phone. When supporters scan it, their signup is attributed to {name}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
