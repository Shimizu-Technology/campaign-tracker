import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getVillages, createSupporter } from '../lib/api';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Village {
  id: number;
  name: string;
  precincts: { id: number; number: string; alpha_range: string }[];
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { leaderCode } = useParams();

  const [form, setForm] = useState({
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
  });

  const { data: villageData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });
  const villages: Village[] = villageData?.villages || [];

  const selectedVillage = villages.find(v => v.id === Number(form.village_id));

  const signup = useMutation({
    mutationFn: (data: any) => createSupporter(data, leaderCode),
    onSuccess: () => navigate('/thank-you'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup.mutate({
      ...form,
      village_id: Number(form.village_id),
      precinct_id: form.precinct_id ? Number(form.precinct_id) : null,
    });
  };

  const updateField = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1B3A6B] text-white py-6 px-4">
        <div className="max-w-lg mx-auto">
          <Link to="/" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="text-2xl font-bold">Support Josh & Tina</h1>
          <p className="text-blue-200 text-sm mt-1">Sign up to show your support for the 2026 campaign</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text"
            required
            value={form.print_name}
            onChange={e => updateField('print_name', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
            placeholder="Juan dela Cruz"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
          <input
            type="tel"
            required
            value={form.contact_number}
            onChange={e => updateField('contact_number', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
            placeholder="671-555-1234"
          />
        </div>

        {/* Village */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Village *</label>
          <select
            required
            value={form.village_id}
            onChange={e => updateField('village_id', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent bg-white"
          >
            <option value="">Select your village</option>
            {villages.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Precinct (auto-populated from village) */}
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

        {/* Street Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
          <input
            type="text"
            value={form.street_address}
            onChange={e => updateField('street_address', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
            placeholder="123 Marine Corps Dr"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => updateField('email', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
            placeholder="juan@example.com"
          />
        </div>

        {/* DOB */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
          <input
            type="date"
            value={form.dob}
            onChange={e => updateField('dob', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
          />
        </div>

        {/* Registered Voter */}
        <div className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            id="registered_voter"
            checked={form.registered_voter}
            onChange={e => updateField('registered_voter', e.target.checked)}
            className="w-5 h-5 text-[#1B3A6B] rounded"
          />
          <label htmlFor="registered_voter" className="text-gray-700">I am a registered voter</label>
        </div>

        {/* Yard Sign */}
        <div className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            id="yard_sign"
            checked={form.yard_sign}
            onChange={e => updateField('yard_sign', e.target.checked)}
            className="w-5 h-5 text-[#1B3A6B] rounded"
          />
          <label htmlFor="yard_sign" className="text-gray-700">I'll put a yard sign up</label>
        </div>

        {/* Motorcade */}
        <div className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            id="motorcade"
            checked={form.motorcade_available}
            onChange={e => updateField('motorcade_available', e.target.checked)}
            className="w-5 h-5 text-[#1B3A6B] rounded"
          />
          <label htmlFor="motorcade" className="text-gray-700">I'll join motorcades</label>
        </div>

        {/* Error */}
        {signup.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            Something went wrong. Please try again.
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={signup.isPending}
          className="w-full bg-[#C41E3A] hover:bg-[#a01830] text-white font-bold py-4 rounded-xl text-lg shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {signup.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing up...
            </>
          ) : (
            'Sign Up!'
          )}
        </button>
      </form>
    </div>
  );
}
