import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getVillages, createSupporter } from '../lib/api';
import { DEFAULT_GUAM_PHONE_PREFIX } from '../lib/phone';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Village {
  id: number;
  name: string;
}

type SignupForm = {
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

export default function SignupPage() {
  const navigate = useNavigate();
  const { leaderCode } = useParams();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    contact_number: DEFAULT_GUAM_PHONE_PREFIX,
    email: '',
    dob: '',
    street_address: '',
    village_id: '',
    registered_voter: true,
    yard_sign: false,
    opt_in_email: false,
    opt_in_text: false,
    motorcade_available: false,
  });

  const { data: villageData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });
  const villages: Village[] = villageData?.villages || [];

  const signup = useMutation({
    mutationFn: (data: Record<string, unknown>) => createSupporter(data, leaderCode),
    onSuccess: () => navigate('/thank-you'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup.mutate({
      ...form,
      village_id: Number(form.village_id),
    });
  };

  const updateField = <K extends keyof SignupForm>(field: K, value: SignupForm[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Header */}
      <div className="bg-primary text-white py-6 px-4">
        <div className="max-w-lg mx-auto">
          <Link to="/" className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-2 min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="text-2xl font-bold">Support Josh & Tina</h1>
          <p className="text-blue-200 text-sm mt-1">Sign up to show your support for the 2026 campaign</p>
        </div>
      </div>

      {/* Leader code banner */}
      {leaderCode && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 text-primary px-4 py-3 rounded-lg text-sm font-medium text-center">
            You were invited by a campaign supporter.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6">
        <div className="app-card p-4 md:p-5 space-y-4">
          <div>
            <h2 className="app-section-title text-lg">Supporter Information</h2>
            <p className="text-sm text-gray-500">Please fill out the form below to join the campaign effort.</p>
          </div>
        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input
              type="text"
              required
              value={form.first_name}
              onChange={e => updateField('first_name', e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Juan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input
              type="text"
              required
              value={form.last_name}
              onChange={e => updateField('last_name', e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="dela Cruz"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
          <input
            type="tel"
            required
            value={form.contact_number}
            onChange={e => updateField('contact_number', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="+1671XXXXXXX"
          />
        </div>

        {/* Village */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Village *</label>
          <select
            required
            value={form.village_id}
            onChange={e => updateField('village_id', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
          >
            <option value="">Select your village</option>
            {villages.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Street Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
          <input
            type="text"
            value={form.street_address}
            onChange={e => updateField('street_address', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
            className="w-full px-3 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
            className="w-full px-3 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Registered Voter */}
        <label htmlFor="registered_voter" className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            id="registered_voter"
            checked={form.registered_voter}
            onChange={e => updateField('registered_voter', e.target.checked)}
            className="w-5 h-5 text-primary rounded shrink-0"
          />
          <span className="text-gray-700">I am a registered voter</span>
        </label>

        {/* Yard Sign */}
        <label htmlFor="yard_sign" className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            id="yard_sign"
            checked={form.yard_sign}
            onChange={e => updateField('yard_sign', e.target.checked)}
            className="w-5 h-5 text-primary rounded shrink-0"
          />
          <span className="text-gray-700">I'll put a yard sign up</span>
        </label>

        {/* Motorcade */}
        <label htmlFor="motorcade" className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            id="motorcade"
            checked={form.motorcade_available}
            onChange={e => updateField('motorcade_available', e.target.checked)}
            className="w-5 h-5 text-primary rounded shrink-0"
          />
          <span className="text-gray-700">I'll join motorcades</span>
        </label>

        {/* Communication Opt-In */}
        <div className="border-t border-gray-200 pt-3 mt-1">
          <p className="text-sm font-medium text-gray-700 mb-2">Stay updated on the campaign:</p>
          <label htmlFor="opt_in_text" className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              id="opt_in_text"
              checked={form.opt_in_text}
              onChange={e => updateField('opt_in_text', e.target.checked)}
              className="w-5 h-5 text-primary rounded shrink-0"
            />
            <span className="text-gray-700">Send me text updates</span>
          </label>
          <label htmlFor="opt_in_email" className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              id="opt_in_email"
              checked={form.opt_in_email}
              onChange={e => updateField('opt_in_email', e.target.checked)}
              className="w-5 h-5 text-primary rounded shrink-0"
            />
            <span className="text-gray-700">Send me email updates</span>
          </label>
          <p className="text-xs text-gray-400 mt-1">
            By checking the above, you agree to receive campaign communications from Josh &amp; Tina 2026. You can opt out at any time.
          </p>
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
            className="w-full bg-cta hover:bg-cta-hover text-white font-bold py-4 rounded-2xl text-lg shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
        </div>
      </form>
    </div>
  );
}
