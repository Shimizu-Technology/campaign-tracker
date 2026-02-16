import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Home, Pencil, Save, UserRound, X } from 'lucide-react';
import { getSupporter, getVillages, updateSupporter, verifySupporter } from '../../lib/api';
import { formatDateTime } from '../../lib/datetime';

interface VillageOption {
  id: number;
  name: string;
  precincts: { id: number; number: string; alpha_range: string }[];
}

interface SupporterDetail {
  id: number;
  first_name: string;
  last_name: string;
  print_name: string;
  contact_number: string;
  email: string | null;
  dob: string | null;
  street_address: string | null;
  village_id: number;
  village_name: string;
  precinct_id: number | null;
  precinct_number: string | null;
  registered_voter: boolean;
  yard_sign: boolean;
  motorcade_available: boolean;
  opt_in_email: boolean;
  opt_in_text: boolean;
  verification_status: string;
  verified_at: string | null;
  verified_by_user_id: number | null;
  potential_duplicate: boolean;
  duplicate_of_id: number | null;
  duplicate_notes: string | null;
  source: string;
  status: string;
  created_at: string;
  events_invited_count: number;
  events_attended_count: number;
  reliability_score: number | null;
}

interface AuditLogItem {
  id: number;
  action: string;
  action_label?: string;
  actor_name?: string;
  actor_role?: string;
  changed_data: Record<string, { from: unknown; to: unknown }>;
  created_at: string;
}

interface SupporterPermissions {
  can_edit: boolean;
}

const AUDIT_FIELD_LABELS: Record<string, string> = {
  id: 'Record ID',
  first_name: 'First Name',
  last_name: 'Last Name',
  print_name: 'Name',
  contact_number: 'Phone',
  email: 'Email',
  dob: 'Date of birth',
  street_address: 'Street address',
  village_id: 'Village ID',
  precinct_id: 'Precinct ID',
  source: 'Source',
  status: 'Status',
  registered_voter: 'Registered voter',
  yard_sign: 'Yard sign',
  motorcade_available: 'Motorcade available',
  opt_in_email: 'Opt-in email',
  opt_in_text: 'Opt-in text',
  created_at: 'Created at',
};

function humanizeRole(role?: string) {
  return role ? role.replaceAll('_', ' ') : 'public/system';
}

function humanizeAuditValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') {
    if (value.includes('T') && !Number.isNaN(new Date(value).getTime())) return formatDateTime(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(parsed);
      }
    }
  }

  return String(value);
}

export default function SupporterDetailPage() {
  const { id } = useParams();
  const supporterId = Number(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return_to') || '/admin/supporters';
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supporter', supporterId],
    queryFn: () => getSupporter(supporterId),
    enabled: Number.isFinite(supporterId),
  });
  const { data: villagesData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });

  const supporter: SupporterDetail | undefined = data?.supporter;
  const permissions: SupporterPermissions | undefined = data?.permissions;
  const auditLogs: AuditLogItem[] = data?.audit_logs || [];
  const villages: VillageOption[] = useMemo(() => villagesData?.villages || [], [villagesData]);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<SupporterDetail> | null>(null);
  const canEdit = permissions?.can_edit ?? false;

  const baseForm = useMemo(() => {
    if (!supporter) return null;
    return {
      first_name: supporter.first_name,
      last_name: supporter.last_name,
      contact_number: supporter.contact_number,
      email: supporter.email || '',
      dob: supporter.dob || '',
      street_address: supporter.street_address || '',
      village_id: supporter.village_id,
      precinct_id: supporter.precinct_id,
      registered_voter: supporter.registered_voter,
      yard_sign: supporter.yard_sign,
      motorcade_available: supporter.motorcade_available,
      opt_in_email: supporter.opt_in_email,
      opt_in_text: supporter.opt_in_text,
    };
  }, [supporter]);

  const currentForm = isEditing ? (draft || baseForm) : baseForm;
  const isDirty = useMemo(() => {
    if (!isEditing || !baseForm) return false;
    return JSON.stringify(draft || baseForm) !== JSON.stringify(baseForm);
  }, [isEditing, baseForm, draft]);

  const selectedVillage = useMemo(
    () => villages.find((v) => v.id === Number(currentForm?.village_id)),
    [villages, currentForm?.village_id]
  );

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateSupporter(supporterId, payload),
    onSuccess: () => {
      setDraft(null);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['supporter', supporterId] });
      queryClient.invalidateQueries({ queryKey: ['supporters'] });
      queryClient.invalidateQueries({ queryKey: ['village'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  useEffect(() => {
    if (!isEditing || !isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isEditing, isDirty]);

  const confirmDiscardIfNeeded = () => {
    if (!isEditing || !isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  };

  const goBack = () => {
    if (!confirmDiscardIfNeeded()) return;
    navigate(returnTo);
  };

  const goHome = () => {
    if (!confirmDiscardIfNeeded()) return;
    navigate('/admin');
  };

  const startEdit = () => {
    if (!canEdit) return;
    if (!baseForm) return;
    setDraft(baseForm);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (!confirmDiscardIfNeeded()) return;
    setDraft(null);
    setIsEditing(false);
  };

  const updateDraft = (patch: Partial<SupporterDetail>) => {
    if (!isEditing || !currentForm) return;
    setDraft((prev) => ({ ...(prev || currentForm), ...patch }));
  };

  if (isLoading || !supporter || !currentForm) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading supporter...</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="bg-[#1B3A6B] text-white py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-2 text-blue-200 hover:text-white text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button type="button" onClick={goHome} className="flex items-center gap-2 text-blue-200 hover:text-white text-sm">
              <Home className="w-4 h-4" /> Home
            </button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserRound className="w-5 h-5" /> {supporter.first_name} {supporter.last_name}
          </h1>
          <p className="text-blue-200 text-sm">
            Signed up {formatDateTime(supporter.created_at)} · {supporter.source === 'qr_signup' ? 'Public Signup' : 'Staff Entry'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              supporter.verification_status === 'verified' ? 'bg-green-500 text-white' :
              supporter.verification_status === 'flagged' ? 'bg-red-500 text-white' :
              'bg-yellow-400 text-yellow-900'
            }`}>
              {supporter.verification_status === 'verified' ? 'Verified' :
               supporter.verification_status === 'flagged' ? 'Flagged' : 'Unverified'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {supporter.potential_duplicate && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Potential Duplicate</p>
              <p className="text-sm text-amber-600 mt-0.5">
                {supporter.duplicate_notes || 'This supporter may be a duplicate of an existing record.'}
              </p>
              {supporter.duplicate_of_id && (
                <Link
                  to={`/admin/supporters/${supporter.duplicate_of_id}`}
                  className="text-sm text-[#1B3A6B] hover:underline mt-1 inline-block"
                >
                  View possible match →
                </Link>
              )}
            </div>
          </div>
        )}

        <section className="app-card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-gray-900">Supporter Details</h2>
            {!isEditing ? (
              canEdit && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="bg-white border border-gray-300 text-gray-700 px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              )
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-white border border-gray-300 text-gray-700 px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveMutation.mutate(currentForm as Record<string, unknown>)}
                  disabled={saveMutation.isPending}
                  className="bg-[#1B3A6B] text-white px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
          {!canEdit && !isEditing && (
            <p className="mb-3 text-xs text-gray-500 italic">
              View only — editing requires campaign admin or district coordinator role.
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <input
              value={String(currentForm.first_name || '')}
              onChange={(e) => updateDraft({ first_name: e.target.value })}
              className="border border-gray-300 rounded-xl px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="First Name"
            />
            <input
              value={String(currentForm.last_name || '')}
              onChange={(e) => updateDraft({ last_name: e.target.value })}
              className="border border-gray-300 rounded-xl px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="Last Name"
            />
            <input
              value={String(currentForm.contact_number || '')}
              onChange={(e) => updateDraft({ contact_number: e.target.value })}
              className="border border-gray-300 rounded-xl px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="Phone Number"
            />
            <input
              value={String(currentForm.email || '')}
              onChange={(e) => updateDraft({ email: e.target.value })}
              className="border border-gray-300 rounded-xl px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="Email"
            />
            <input
              type="date"
              value={String(currentForm.dob || '')}
              onChange={(e) => updateDraft({ dob: e.target.value })}
              className="border border-gray-300 rounded-xl px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
            />
            <input
              value={String(currentForm.street_address || '')}
              onChange={(e) => updateDraft({ street_address: e.target.value })}
              className="border border-gray-300 rounded-xl px-3 py-2 md:col-span-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="Street Address"
            />
            <select
              value={String(currentForm.village_id || '')}
              onChange={(e) => updateDraft({ village_id: Number(e.target.value), precinct_id: null })}
              className="border border-gray-300 rounded-xl px-3 py-2 bg-white disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
            >
              {villages.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <select
              value={currentForm.precinct_id ? String(currentForm.precinct_id) : ''}
              onChange={(e) => updateDraft({ precinct_id: e.target.value ? Number(e.target.value) : null })}
              className="border border-gray-300 rounded-xl px-3 py-2 bg-white disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
            >
              <option value="">Not assigned</option>
              {(selectedVillage?.precincts || []).map((p) => (
                <option key={p.id} value={p.id}>Precinct {p.number} ({p.alpha_range})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(currentForm.registered_voter)}
                onChange={(e) => updateDraft({ registered_voter: e.target.checked })}
                disabled={!isEditing}
              />
              Registered voter
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(currentForm.yard_sign)}
                onChange={(e) => updateDraft({ yard_sign: e.target.checked })}
                disabled={!isEditing}
              />
              Yard sign
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(currentForm.motorcade_available)}
                onChange={(e) => updateDraft({ motorcade_available: e.target.checked })}
                disabled={!isEditing}
              />
              Motorcade
            </label>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-200">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(currentForm.opt_in_text)}
                onChange={(e) => updateDraft({ opt_in_text: e.target.checked })}
                disabled={!isEditing}
              />
              Text updates
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(currentForm.opt_in_email)}
                onChange={(e) => updateDraft({ opt_in_email: e.target.checked })}
                disabled={!isEditing}
              />
              Email updates
            </label>
          </div>
        </section>

        <section className="app-card p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Verification</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              supporter.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
              supporter.verification_status === 'flagged' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {supporter.verification_status === 'verified' ? 'Verified' :
               supporter.verification_status === 'flagged' ? 'Flagged' : 'Unverified'}
            </span>
            {canEdit && supporter.verification_status !== 'verified' && (
              <button
                onClick={async () => {
                  try {
                    await verifySupporter(supporter.id, 'verified');
                    refetch();
                  } catch {
                    alert('Failed to verify supporter. You may not have permission.');
                  }
                }}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Mark Verified
              </button>
            )}
            {canEdit && supporter.verification_status !== 'flagged' && (
              <button
                onClick={async () => {
                  try {
                    await verifySupporter(supporter.id, 'flagged');
                    refetch();
                  } catch {
                    alert('Failed to flag supporter. You may not have permission.');
                  }
                }}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              >
                Flag
              </button>
            )}
            {canEdit && supporter.verification_status !== 'unverified' && (
              <button
                onClick={async () => {
                  try {
                    await verifySupporter(supporter.id, 'unverified');
                    refetch();
                  } catch {
                    alert('Failed to reset verification. You may not have permission.');
                  }
                }}
                className="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
              >
                Reset
              </button>
            )}
          </div>
          {supporter.verified_at && (
            <p className="text-xs text-gray-400 mt-2">
              Last updated: {formatDateTime(supporter.verified_at)}
            </p>
          )}
        </section>

        <section className="app-card p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Engagement Snapshot</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border rounded-xl p-3">
              <div className="text-xl font-bold">{supporter.events_invited_count}</div>
              <div className="text-xs text-gray-500">Invited</div>
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-xl font-bold">{supporter.events_attended_count}</div>
              <div className="text-xs text-gray-500">Attended</div>
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-xl font-bold">{supporter.reliability_score ?? '—'}</div>
              <div className="text-xs text-gray-500">Reliability</div>
            </div>
          </div>
        </section>

        <section className="app-card p-4">
          <details>
            <summary className="cursor-pointer font-semibold text-gray-900">
              Audit History ({auditLogs.length})
            </summary>
            <p className="text-xs text-gray-500 mt-1">Shows what changed, who changed it, and when.</p>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-gray-500 mt-3">No changes logged yet.</p>
            ) : (
              <div className="space-y-2 mt-3">
                {auditLogs.map((log) => {
                  const changedFields = Object.entries(log.changed_data || {});
                  return (
                    <details key={log.id} className="border rounded-xl p-3">
                      <summary className="cursor-pointer">
                        <div className="text-sm font-medium text-gray-900 inline">
                          {log.action_label || log.action} by {log.actor_name || 'System/Public'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {humanizeRole(log.actor_role)} · {formatDateTime(log.created_at)}
                          {changedFields.length > 0 ? ` · ${changedFields.length} field${changedFields.length === 1 ? '' : 's'} changed` : ''}
                        </div>
                      </summary>
                      {changedFields.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {changedFields.map(([field, diff]) => (
                            <div key={field} className="text-xs text-gray-700">
                              <span className="font-medium">{AUDIT_FIELD_LABELS[field] || field.replaceAll('_', ' ')}:</span>{' '}
                              <span className="text-gray-500">{humanizeAuditValue(diff.from)}</span>
                              {' -> '}
                              <span>{humanizeAuditValue(diff.to)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </details>
                  );
                })}
              </div>
            )}
          </details>
        </section>
      </div>
    </div>
  );
}
