import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getVillages, createSupporter } from '../lib/api';
import { captureAnalyticsEvent } from '../lib/analytics';
import { DEFAULT_GUAM_PHONE_PREFIX } from '../lib/phone';
import { ArrowLeft, Loader2, Megaphone, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicWordmark from '../components/PublicWordmark';

interface Village {
  id: number;
  name: string;
}

type SignupForm = {
  first_name: string;
  middle_name: string;
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
    middle_name: '',
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
    onSuccess: () => {
      captureAnalyticsEvent('public_signup_submitted', {
        has_leader_code: Boolean(leaderCode),
        village_id: form.village_id ? Number(form.village_id) : undefined,
        self_reported_registered_voter: form.registered_voter,
        opted_in_email: form.opt_in_email,
        opted_in_text: form.opt_in_text,
        yard_sign: form.yard_sign,
        motorcade_available: form.motorcade_available,
      });
      navigate('/thank-you');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup.mutate({
      ...form,
      self_reported_registered_voter: form.registered_voter,
      village_id: Number(form.village_id),
    });
  };

  const updateField = <K extends keyof SignupForm>(field: K, value: SignupForm[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <div className="bg-primary px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.24em] text-white">
        Official supporter signup
      </div>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
          <Link to="/" className="mb-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-6">
            <div className="space-y-4">
              <PublicWordmark size="md" />
              <div>
                <h1 className="text-[2rem] font-extrabold tracking-tight text-slate-950 md:text-5xl">
                  Sign up to support the campaign.
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                  Add your name, tell us where you are, and choose how you would like to stay connected with Josh and Tina&apos;s campaign.
                </p>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_-32px_rgba(15,42,91,0.35)] lg:block">
              <div className="bg-linear-to-r from-primary via-[#2c66bb] to-[#84bde7] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
                  Let&apos;s go Guam
                </p>
                <p className="mt-2 text-xl font-bold text-white">
                  Join the supporter network
                </p>
              </div>
              <img
                src="/joshtina-supporter.jpeg"
                alt="Let's Go Guam supporter artwork"
                className="h-40 w-full bg-white object-contain p-4 md:h-56"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {leaderCode && (
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-primary">
            You were invited by a campaign supporter.
          </div>
        )}

        <div className="mb-5 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-white p-2">
              <img
                src="/joshtina-supporter.jpeg"
                alt="Let's Go Guam supporter artwork"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Let&apos;s go Guam
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Add your information below to join the supporter network and stay connected with the campaign.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <aside className="order-2 space-y-4 lg:order-1">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">What happens next</p>
              <div className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">The campaign records your support</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Your information helps the campaign understand where support is growing across Guam.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff1ef] text-cta">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">You can receive campaign updates</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Opt in for email or text messages if you want campaign announcements and outreach.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef6ff] text-[#1d74d1]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">This form is mobile-friendly</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Complete it on your phone in just a few moments. Required fields are marked with an asterisk.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#f0d9a4] bg-[#fff9ec] p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#93650d]">Campaign note</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                By submitting this form, you are sharing your information with the campaign so the team can stay in touch, invite you to campaign activity, and organize supporter outreach.
              </p>
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="order-1 rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-32px_rgba(15,42,91,0.35)] md:p-6 lg:order-2">
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Supporter information</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Fill out the form below to join the campaign effort.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={e => updateField('first_name', e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Middle Name</label>
                  <input
                    type="text"
                    value={form.middle_name}
                    onChange={e => updateField('middle_name', e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="Maria"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={e => updateField('last_name', e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="dela Cruz"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={form.contact_number}
                  onChange={e => updateField('contact_number', e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-primary"
                  placeholder="+1671XXXXXXX"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Village *</label>
                <select
                  required
                  value={form.village_id}
                  onChange={e => updateField('village_id', e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select your village</option>
                  {villages.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Street Address</label>
                <input
                  type="text"
                  value={form.street_address}
                  onChange={e => updateField('street_address', e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-primary"
                  placeholder="123 Marine Corps Dr"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-primary"
                  placeholder="juan@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={e => updateField('dob', e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
                <label htmlFor="registered_voter" className="flex min-h-[44px] cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    id="registered_voter"
                    checked={form.registered_voter}
                    onChange={e => updateField('registered_voter', e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded text-primary"
                  />
                  <span className="text-gray-700">I believe I am a registered voter</span>
                </label>

                <label htmlFor="yard_sign" className="flex min-h-[44px] cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    id="yard_sign"
                    checked={form.yard_sign}
                    onChange={e => updateField('yard_sign', e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded text-primary"
                  />
                  <span className="text-gray-700">I&apos;ll put a yard sign up</span>
                </label>

                <label htmlFor="motorcade" className="flex min-h-[44px] cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    id="motorcade"
                    checked={form.motorcade_available}
                    onChange={e => updateField('motorcade_available', e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded text-primary"
                  />
                  <span className="text-gray-700">I&apos;ll join motorcades</span>
                </label>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                <p className="mb-2 text-sm font-medium text-gray-700">Stay updated on the campaign:</p>
                <label htmlFor="opt_in_text" className="flex min-h-[44px] cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    id="opt_in_text"
                    checked={form.opt_in_text}
                    onChange={e => updateField('opt_in_text', e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded text-primary"
                  />
                  <span className="text-gray-700">Send me text updates</span>
                </label>
                <label htmlFor="opt_in_email" className="flex min-h-[44px] cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    id="opt_in_email"
                    checked={form.opt_in_email}
                    onChange={e => updateField('opt_in_email', e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded text-primary"
                  />
                  <span className="text-gray-700">Send me email updates</span>
                </label>
                <p className="mt-2 text-xs leading-5 text-gray-400">
                  By checking the above, you agree to receive campaign communications from Josh &amp; Tina 2026. You can opt out at any time.
                </p>
              </div>

              {signup.isError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  Something went wrong. Please try again.
                </div>
              )}

              <button
                type="submit"
                disabled={signup.isPending}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-cta px-6 text-lg font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-cta-hover disabled:opacity-50"
              >
                {signup.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing up...
                  </>
                ) : (
                  'Sign up now'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
