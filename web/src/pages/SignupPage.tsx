import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { getVillages, createSupporter } from '../lib/api';
import { captureAnalyticsEvent } from '../lib/analytics';
import { DEFAULT_GUAM_PHONE_PREFIX } from '../lib/phone';

interface Village {
  id: number;
  name: string;
}

type RegisteredVoterStatus = 'yes' | 'no' | 'not_sure';

type HouseholdMemberForm = {
  id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  dob: string;
  self_reported_registered_voter_status: RegisteredVoterStatus;
  self_reported_voting_location: string;
  share_contact_number: boolean;
  share_email: boolean;
  contact_number: string;
  email: string;
  wants_to_volunteer: boolean;
  needs_absentee_ballot_help: boolean;
  needs_homebound_voting_help: boolean;
  needs_voter_registration_help: boolean;
  needs_election_day_ride: boolean;
};

type SignupForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  contact_number: string;
  email: string;
  dob: string;
  street_address: string;
  village_id: string;
  self_reported_registered_voter_status: RegisteredVoterStatus;
  self_reported_voting_location: string;
  yard_sign: boolean;
  motorcade_available: boolean;
  wants_to_volunteer: boolean;
  needs_absentee_ballot_help: boolean;
  needs_homebound_voting_help: boolean;
  needs_voter_registration_help: boolean;
  needs_election_day_ride: boolean;
  referred_by_name: string;
  opt_in_email: boolean;
  opt_in_text: boolean;
  household_members: HouseholdMemberForm[];
};

function createHouseholdMember(): HouseholdMemberForm {
  return {
    id: crypto.randomUUID(),
    first_name: '',
    middle_name: '',
    last_name: '',
    dob: '',
    self_reported_registered_voter_status: 'yes',
    self_reported_voting_location: '',
    share_contact_number: true,
    share_email: true,
    contact_number: '',
    email: '',
    wants_to_volunteer: false,
    needs_absentee_ballot_help: false,
    needs_homebound_voting_help: false,
    needs_voter_registration_help: false,
    needs_election_day_ride: false,
  };
}

function FormCheckbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 cursor-pointer min-h-[52px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-primary focus:ring-primary"
      />
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {description ? <span className="block text-xs text-slate-500 mt-0.5">{description}</span> : null}
      </span>
    </label>
  );
}

function RegisteredVoterField({
  value,
  votingLocation,
  onChange,
  onVotingLocationChange,
  title,
}: {
  value: RegisteredVoterStatus;
  votingLocation: string;
  onChange: (value: RegisteredVoterStatus) => void;
  onVotingLocationChange: (value: string) => void;
  title: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-1">This helps the campaign know who may need registration help or a closer voter lookup.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'not_sure', label: 'Not Sure' },
        ].map(option => (
          <label
            key={option.value}
            className={`rounded-2xl border px-4 py-3 cursor-pointer transition ${
              value === option.value ? 'border-primary bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name={title}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value as RegisteredVoterStatus)}
              className="sr-only"
            />
            <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
          </label>
        ))}
      </div>
      {value === 'yes' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            If yes, where do you vote if different from where you live?
          </label>
          <input
            type="text"
            value={votingLocation}
            onChange={e => onVotingLocationChange(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="Optional voting village or polling location"
          />
        </div>
      )}
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { leaderCode } = useParams();

  const [form, setForm] = useState<SignupForm>({
    first_name: '',
    middle_name: '',
    last_name: '',
    contact_number: DEFAULT_GUAM_PHONE_PREFIX,
    email: '',
    dob: '',
    street_address: '',
    village_id: '',
    self_reported_registered_voter_status: 'yes',
    self_reported_voting_location: '',
    yard_sign: false,
    motorcade_available: false,
    wants_to_volunteer: false,
    needs_absentee_ballot_help: false,
    needs_homebound_voting_help: false,
    needs_voter_registration_help: false,
    needs_election_day_ride: false,
    referred_by_name: '',
    opt_in_email: false,
    opt_in_text: false,
    household_members: [],
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
        self_reported_registered_voter_status: form.self_reported_registered_voter_status,
        opted_in_email: form.opt_in_email,
        opted_in_text: form.opt_in_text,
        yard_sign_interest: form.yard_sign,
        motorcade_available: form.motorcade_available,
        help_request_count: [
          form.wants_to_volunteer,
          form.needs_absentee_ballot_help,
          form.needs_homebound_voting_help,
          form.needs_voter_registration_help,
          form.needs_election_day_ride,
        ].filter(Boolean).length,
        household_member_count: form.household_members.length,
      });
      navigate('/thank-you');
    },
  });

  const updateField = <K extends keyof SignupForm>(field: K, value: SignupForm[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const updateHouseholdMember = <K extends keyof HouseholdMemberForm>(id: string, field: K, value: HouseholdMemberForm[K]) => {
    setForm(prev => ({
      ...prev,
      household_members: prev.household_members.map(member => member.id === id ? { ...member, [field]: value } : member),
    }));
  };

  const addHouseholdMember = () => {
    setForm(prev => ({ ...prev, household_members: [ ...prev.household_members, createHouseholdMember() ] }));
  };

  const removeHouseholdMember = (id: string) => {
    setForm(prev => ({ ...prev, household_members: prev.household_members.filter(member => member.id !== id) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      first_name: form.first_name,
      middle_name: form.middle_name,
      last_name: form.last_name,
      contact_number: form.contact_number,
      email: form.email,
      dob: form.dob || undefined,
      street_address: form.street_address,
      village_id: Number(form.village_id),
      self_reported_registered_voter_status: form.self_reported_registered_voter_status,
      self_reported_voting_location:
        form.self_reported_registered_voter_status === 'yes' ? form.self_reported_voting_location : undefined,
      yard_sign: form.yard_sign,
      motorcade_available: form.motorcade_available,
      wants_to_volunteer: form.wants_to_volunteer,
      needs_absentee_ballot_help: form.needs_absentee_ballot_help,
      needs_homebound_voting_help: form.needs_homebound_voting_help,
      needs_voter_registration_help: form.needs_voter_registration_help,
      needs_election_day_ride: form.needs_election_day_ride,
      referred_by_name: leaderCode ? undefined : form.referred_by_name || undefined,
      opt_in_email: form.opt_in_email,
      opt_in_text: form.opt_in_text,
      household_members: form.household_members.map(member => ({
        first_name: member.first_name,
        middle_name: member.middle_name,
        last_name: member.last_name,
        dob: member.dob || undefined,
        village_id: Number(form.village_id),
        street_address: form.street_address || undefined,
        contact_number: member.share_contact_number ? form.contact_number : member.contact_number,
        email: member.share_email ? form.email || undefined : member.email || undefined,
        self_reported_registered_voter_status: member.self_reported_registered_voter_status,
        self_reported_voting_location:
          member.self_reported_registered_voter_status === 'yes' ? member.self_reported_voting_location : undefined,
        wants_to_volunteer: member.wants_to_volunteer,
        needs_absentee_ballot_help: member.needs_absentee_ballot_help,
        needs_homebound_voting_help: member.needs_homebound_voting_help,
        needs_voter_registration_help: member.needs_voter_registration_help,
        needs_election_day_ride: member.needs_election_day_ride,
      })),
    };

    signup.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0b1d3b_0%,#133d74_28%,#f4f7fb_28%,#f4f7fb_100%)]">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white min-h-[44px] mb-5">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] items-start">
          <section className="rounded-[28px] overflow-hidden bg-white/10 backdrop-blur-sm border border-white/15 shadow-2xl">
            <img src="/joshtina-supporter.jpeg" alt="Josh and Tina supporter campaign" className="h-64 w-full object-cover" />
            <div className="p-6 md:p-8 text-white">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-100 font-semibold">Josh & Tina 2026</p>
              <h1 className="text-3xl md:text-4xl font-bold mt-3 leading-tight">Join the campaign and help us organize village by village.</h1>
              <p className="text-blue-100 mt-4 text-sm md:text-base leading-6">
                Sign up yourself, let us know if your household is with us too, and tell us if anyone needs voter registration or election-day support.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-blue-100">Mobile friendly</p>
                  <p className="mt-1 text-sm font-semibold">Built for quick signups in the field</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-blue-100">Households</p>
                  <p className="mt-1 text-sm font-semibold">Add family members in one submission</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-blue-100">Follow-up ready</p>
                  <p className="mt-1 text-sm font-semibold">Registration and assistance requests are tracked for staff</p>
                </div>
              </div>
              {leaderCode && (
                <div className="mt-6 rounded-2xl border border-blue-200/30 bg-blue-300/10 px-4 py-3 text-sm font-medium text-blue-50">
                  You were invited by a campaign supporter.
                </div>
              )}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="rounded-[28px] bg-white shadow-xl border border-slate-200 p-5 md:p-7 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Supporter Signup</p>
              <h2 className="text-2xl font-bold text-slate-900 mt-2">Tell us about you</h2>
              <p className="text-sm text-slate-500 mt-2">
                Please fill this out for yourself first. You can add other people from your household farther below.
              </p>
            </div>

            <section className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={e => updateField('first_name', e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Middle Name</label>
                  <input
                    type="text"
                    value={form.middle_name}
                    onChange={e => updateField('middle_name', e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Maria"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={e => updateField('last_name', e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="dela Cruz"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={form.contact_number}
                    onChange={e => updateField('contact_number', e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="+1671XXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => updateField('email', e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Village *</label>
                  <select
                    required
                    value={form.village_id}
                    onChange={e => updateField('village_id', e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base bg-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select your village</option>
                    {villages.map(village => (
                      <option key={village.id} value={village.id}>{village.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={e => updateField('dob', e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Street Address</label>
                <input
                  type="text"
                  value={form.street_address}
                  onChange={e => updateField('street_address', e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="123 Marine Corps Dr"
                />
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-6">
              <RegisteredVoterField
                title="Are you registered to vote?"
                value={form.self_reported_registered_voter_status}
                votingLocation={form.self_reported_voting_location}
                onChange={value => updateField('self_reported_registered_voter_status', value)}
                onVotingLocationChange={value => updateField('self_reported_voting_location', value)}
              />
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900">How can we help?</h3>
                <p className="text-sm text-slate-500 mt-1">Let the campaign know if you want to get involved or need support.</p>
              </div>
              <div className="grid gap-3">
                <FormCheckbox checked={form.wants_to_volunteer} onChange={checked => updateField('wants_to_volunteer', checked)} label="I want to get involved in the campaign" />
                <FormCheckbox checked={form.needs_absentee_ballot_help} onChange={checked => updateField('needs_absentee_ballot_help', checked)} label="I may need absentee ballot assistance" />
                <FormCheckbox checked={form.needs_homebound_voting_help} onChange={checked => updateField('needs_homebound_voting_help', checked)} label="I may need homebound voting assistance" />
                <FormCheckbox checked={form.needs_voter_registration_help} onChange={checked => updateField('needs_voter_registration_help', checked)} label="I may need help registering to vote" />
                <FormCheckbox checked={form.needs_election_day_ride} onChange={checked => updateField('needs_election_day_ride', checked)} label="I may need a ride to the polls on election day" />
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Campaign Interest</h3>
                <p className="text-sm text-slate-500 mt-1">These help staff understand how to follow up. Checking a box does not guarantee a sign or event invitation.</p>
              </div>
              <div className="grid gap-3">
                <FormCheckbox
                  checked={form.yard_sign}
                  onChange={checked => updateField('yard_sign', checked)}
                  label="I am interested in putting up a yard sign if signs are available"
                />
                <FormCheckbox
                  checked={form.motorcade_available}
                  onChange={checked => updateField('motorcade_available', checked)}
                  label="I am interested in joining motorcades"
                />
              </div>
            </section>

            {!leaderCode && (
              <section className="border-t border-slate-200 pt-6">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Who referred you?</label>
                <input
                  type="text"
                  value={form.referred_by_name}
                  onChange={e => updateField('referred_by_name', e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Optional name"
                />
              </section>
            )}

            <section className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <h3 className="text-base font-semibold text-slate-900">Add your household</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    One person can submit the household. Additional household members will stay linked together in the system.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addHouseholdMember}
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-primary hover:bg-blue-100"
                >
                  <Plus className="w-4 h-4" />
                  Add person
                </button>
              </div>

              <div className="space-y-4">
                {form.household_members.map((member, index) => (
                  <div key={member.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">Household Member {index + 1}</h4>
                        <p className="text-xs text-slate-500 mt-1">Contact info can stay shared with the primary person or be overridden below.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeHouseholdMember(member.id)}
                        className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name *</label>
                        <input
                          type="text"
                          required
                          value={member.first_name}
                          onChange={e => updateHouseholdMember(member.id, 'first_name', e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Middle Name</label>
                        <input
                          type="text"
                          value={member.middle_name}
                          onChange={e => updateHouseholdMember(member.id, 'middle_name', e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={member.last_name}
                          onChange={e => updateHouseholdMember(member.id, 'last_name', e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
                        <input
                          type="date"
                          value={member.dob}
                          onChange={e => updateHouseholdMember(member.id, 'dob', e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormCheckbox
                        checked={member.share_contact_number}
                        onChange={checked => updateHouseholdMember(member.id, 'share_contact_number', checked)}
                        label="Use the primary phone number"
                      />
                      <FormCheckbox
                        checked={member.share_email}
                        onChange={checked => updateHouseholdMember(member.id, 'share_email', checked)}
                        label="Use the primary email"
                      />
                    </div>

                    {!member.share_contact_number && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number *</label>
                        <input
                          type="tel"
                          required={!member.share_contact_number}
                          value={member.contact_number}
                          onChange={e => updateHouseholdMember(member.id, 'contact_number', e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                          placeholder="+1671XXXXXXX"
                        />
                      </div>
                    )}

                    {!member.share_email && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                        <input
                          type="email"
                          value={member.email}
                          onChange={e => updateHouseholdMember(member.id, 'email', e.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                          placeholder="name@example.com"
                        />
                      </div>
                    )}

                    <RegisteredVoterField
                      title={`Is household member ${index + 1} registered to vote?`}
                      value={member.self_reported_registered_voter_status}
                      votingLocation={member.self_reported_voting_location}
                      onChange={value => updateHouseholdMember(member.id, 'self_reported_registered_voter_status', value)}
                      onVotingLocationChange={value => updateHouseholdMember(member.id, 'self_reported_voting_location', value)}
                    />

                    <div className="grid gap-3">
                      <FormCheckbox checked={member.wants_to_volunteer} onChange={checked => updateHouseholdMember(member.id, 'wants_to_volunteer', checked)} label="This person wants to get involved in the campaign" />
                      <FormCheckbox checked={member.needs_absentee_ballot_help} onChange={checked => updateHouseholdMember(member.id, 'needs_absentee_ballot_help', checked)} label="This person may need absentee ballot assistance" />
                      <FormCheckbox checked={member.needs_homebound_voting_help} onChange={checked => updateHouseholdMember(member.id, 'needs_homebound_voting_help', checked)} label="This person may need homebound voting assistance" />
                      <FormCheckbox checked={member.needs_voter_registration_help} onChange={checked => updateHouseholdMember(member.id, 'needs_voter_registration_help', checked)} label="This person may need help registering to vote" />
                      <FormCheckbox checked={member.needs_election_day_ride} onChange={checked => updateHouseholdMember(member.id, 'needs_election_day_ride', checked)} label="This person may need a ride to the polls" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Stay updated</h3>
                <p className="text-sm text-slate-500 mt-1">Only opt in if you want campaign communications from Josh & Tina 2026.</p>
              </div>
              <div className="grid gap-3">
                <FormCheckbox checked={form.opt_in_text} onChange={checked => updateField('opt_in_text', checked)} label="Send me text updates" />
                <FormCheckbox checked={form.opt_in_email} onChange={checked => updateField('opt_in_email', checked)} label="Send me email updates" />
              </div>
              <p className="text-xs text-slate-400">
                By opting in, you agree to receive campaign communications from Josh &amp; Tina 2026. You can opt out at any time.
              </p>
            </section>

            {signup.isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Something went wrong. Please review the form and try again.
              </div>
            )}

            <button
              type="submit"
              disabled={signup.isPending}
              className="w-full rounded-2xl bg-cta px-5 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-cta-hover disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {signup.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Support'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
