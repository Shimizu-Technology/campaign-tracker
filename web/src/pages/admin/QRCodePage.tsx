import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, QrCode, Copy, Check, Download } from 'lucide-react';
import api from '../../lib/api';

interface QRResult {
  code: string;
  signup_url: string;
  qr_svg_url: string;
}

export default function QRCodePage() {
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [generated, setGenerated] = useState<QRResult | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useMutation({
    mutationFn: () => api.post('/qr_codes/generate', { name, village }).then(r => r.data),
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

  const qrSvgUrl = generated ? `/api/v1/qr_codes/${generated.code}` : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-lg mx-auto">
          <Link to="/admin" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <QrCode className="w-6 h-6" /> QR Code Generator
          </h1>
          <p className="text-blue-200 text-sm mt-1">Generate unique QR codes for block leaders</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Generator Form */}
        <form onSubmit={handleGenerate} className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Generate New QR Code</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Block Leader Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Pedro Reyes"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Village</label>
              <input
                type="text"
                required
                value={village}
                onChange={e => setVillage(e.target.value)}
                placeholder="Tamuning"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={generate.isPending}
              className="w-full bg-[#1B3A6B] hover:bg-[#152e55] text-white font-bold py-3 rounded-lg"
            >
              {generate.isPending ? 'Generating...' : 'Generate QR Code'}
            </button>
          </div>
        </form>

        {/* Generated QR */}
        {generated && (
          <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
            <h2 className="font-semibold text-gray-800 mb-2">QR Code for {name}</h2>
            <p className="text-sm text-gray-500 mb-4">Village: {village} · Code: {generated.code}</p>

            {/* QR Image */}
            <div className="flex justify-center mb-6">
              <img
                src={qrSvgUrl!}
                alt={`QR Code for ${name}`}
                className="w-64 h-64 border rounded-xl p-2"
              />
            </div>

            {/* Signup URL */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Signup Link</p>
              <p className="text-sm text-[#1B3A6B] font-mono break-all">{generated.signup_url}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2 px-4 hover:bg-gray-50 text-sm font-medium"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={qrSvgUrl!}
                download={`qr-${generated.code}.svg`}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1B3A6B] text-white rounded-lg py-2 px-4 hover:bg-[#152e55] text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Download SVG
              </a>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              Print this QR code on flyers or display on your phone. When supporters scan it, their signup is attributed to {name}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
