import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOutreachSupporters, updateOutreachStatus } from '../../lib/api';
import { formatDateTime } from '../../lib/datetime';
import WorkspacePage from '../../components/WorkspacePage';

interface OutreachSupporter {
  id: number;
  first_name: string;
  last_name: string;
  village_name: string;
  contact_number: string;
  email: string | null;
  source: string;
  intake_status: string;
  review_status: string;
  public_review_status: string;
  self_reported_registered_voter_status?: string | null;
  self_reported_voting_location?: string | null;
  registered_voter: boolean;
  verification_status: string;
  verification_reason?: string | null;
  verification_reason_label?: string | null;
  referred_by_name?: string | null;
  household_group_id?: number | null;
  wants_to_volunteer?: boolean;
  needs_absentee_ballot_help?: boolean;
  needs_homebound_voting_help?: boolean;
  needs_voter_registration_help?: boolean;
  needs_election_day_ride?: boolean;
  campaign_help_requests?: string[];
  registration_outreach_status: string | null;
  registration_outreach_date: string | null;
  registration_outreach_notes: string | null;
  registration_outreach_updated_by_user_name?: string | null;
}

interface OutreachCounts {
  total: number;
  not_contacted: number;
  contacted: number;
  registered: number;
  declined: number;
  no_gec_match: number;
  registration_help: number;
  absentee_help: number;
  homebound_help: number;
  ride_help: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'registered', label: 'Registered' },
  { value: 'declined', label: 'Declined' },
];

const REASON_OPTIONS = [
  { value: '', label: 'All follow-up reasons' },
  { value: 'no_gec_match', label: 'No GEC match' },
  { value: 'registration_help', label: 'Registration help' },
  { value: 'absentee', label: 'Absentee ballot help' },
  { value: 'homebound', label: 'Homebound voting help' },
  { value: 'ride', label: 'Ride to polls' },
  { value: 'campaign', label: 'Campaign involvement' },
];

const STATUS_BADGES: Record<string, string> = {
  contacted: 'bg-blue-100 text-blue-800',
  registered: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string | null }) {
  const classes = STATUS_BADGES[status || ''] || 'bg-slate-100 text-slate-700';
  const label = status ? status.replace(/_/g, ' ') : 'not contacted';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}>{label}</span>;
}

export default function OutreachPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');

  const params: Record<string, string | number> = { page, per_page: 50 };
  if (search) params.search = search;
  if (statusFilter && statusFilter !== 'not_contacted') params.outreach_status = statusFilter;
  if (reasonFilter) params.followup_reason = reasonFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['outreach', page, search, statusFilter, reasonFilter],
    queryFn: () => getOutreachSupporters(params),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateOutreachStatus(id, { registration_outreach_status: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach'] });
    },
  });

  const supporters: OutreachSupporter[] = data?.supporters || [];
  const counts: OutreachCounts = data?.counts || {
    total: 0,
    not_contacted: 0,
    contacted: 0,
    registered: 0,
    declined: 0,
    no_gec_match: 0,
    registration_help: 0,
    absentee_help: 0,
    homebound_help: 0,
    ride_help: 0,
  };
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <WorkspacePage width="full" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Registration & Support Follow-Up
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          People needing registration follow-up, public assistance, or manual outreach after signup.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{counts.total}</div>
          <div className="text-xs text-gray-500">Total Queue</div>
        </div>
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-gray-500">{counts.not_contacted}</div>
          <div className="text-xs text-gray-500">Not Contacted</div>
        </div>
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{counts.no_gec_match}</div>
          <div className="text-xs text-gray-500">No GEC Match</div>
        </div>
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{counts.registration_help}</div>
          <div className="text-xs text-gray-500">Registration Help</div>
        </div>
        <div className="app-card p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{counts.registered}</div>
          <div className="text-xs text-gray-500">Marked Registered</div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm"
          />
        </div>
        <select
          value={reasonFilter}
          onChange={e => { setReasonFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
        >
          {REASON_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="app-card overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : supporters.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No supporters found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Village</th>
                <th className="px-4 py-3 hidden lg:table-cell">Contact</th>
                <th className="px-4 py-3">Why Follow Up</th>
                <th className="px-4 py-3 hidden xl:table-cell">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden xl:table-cell">Last Contact</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {supporters.map(supporter => (
                <tr key={supporter.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">
                    <Link to={`/admin/supporters/${supporter.id}`} className="text-primary hover:underline font-medium">
                      {supporter.first_name} {supporter.last_name}
                    </Link>
                    {supporter.household_group_id ? (
                      <div className="mt-1 text-xs text-gray-500">Linked household</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{supporter.village_name}</td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                    <div>{supporter.contact_number || '—'}</div>
                    <div className="text-xs text-gray-500 mt-1">{supporter.email || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {supporter.verification_reason === 'no_gec_match' ? (
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">No GEC match</span>
                      ) : null}
                      {supporter.needs_voter_registration_help ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Registration help</span>
                      ) : null}
                      {supporter.needs_absentee_ballot_help ? (
                        <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">Absentee help</span>
                      ) : null}
                      {supporter.needs_homebound_voting_help ? (
                        <span className="inline-flex rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-medium text-fuchsia-700">Homebound help</span>
                      ) : null}
                      {supporter.needs_election_day_ride ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Ride to polls</span>
                      ) : null}
                      {supporter.wants_to_volunteer ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Campaign involvement</span>
                      ) : null}
                      {!supporter.verification_reason && (!supporter.campaign_help_requests || supporter.campaign_help_requests.length === 0) ? (
                        <span className="text-xs text-gray-500">Needs follow-up</span>
                      ) : null}
                    </div>
                    {supporter.self_reported_registered_voter_status && (
                      <div className="mt-2 text-xs text-gray-500">
                        Self-reported voter: {supporter.self_reported_registered_voter_status.replace('_', ' ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500">
                    <div className="capitalize">{supporter.source.replace(/_/g, ' ')}</div>
                    <div className="mt-1">Review: {supporter.review_status.replace(/_/g, ' ')}</div>
                    <div className="mt-1">Public: {supporter.public_review_status.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={supporter.registration_outreach_status} />
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500">
                    <div>{supporter.registration_outreach_date ? formatDateTime(supporter.registration_outreach_date) : '—'}</div>
                    {supporter.registration_outreach_updated_by_user_name ? (
                      <div className="mt-1">By {supporter.registration_outreach_updated_by_user_name}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={supporter.registration_outreach_status || ''}
                      onChange={e => {
                        if (e.target.value) {
                          updateMutation.mutate({ id: supporter.id, status: e.target.value });
                        }
                      }}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white min-w-[130px]"
                    >
                      <option value="">Set status...</option>
                      <option value="contacted">Contacted</option>
                      <option value="registered">Registered</option>
                      <option value="declined">Declined</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </WorkspacePage>
  );
}
