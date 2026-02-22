import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Pencil, Save, UserRound, X } from 'lucide-react';
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
  leader_code?: string | null;
  referral_code_id?: number | null;
  referral_display_name?: string | null;
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
  leader_code: 'Referral code',
  status: 'Status',
  verification_status: 'Verification status',
  attribution_method: 'Entry method',
  referral_code_id: 'Referrer',
  registered_voter: 'Registered voter',
  yard_sign: 'Yard sign',
  motorcade_available: 'Motorcade available',
  opt_in_email: 'Opt-in email',
  opt_in_text: 'Opt-in text',
  created_at: 'Created at',
};

const AUDIT_VALUE_LABELS: Record<string, Record<string, string>> = {
  source: {
    qr_signup: 'QR signup',
    staff_entry: 'Staff entry',
    bulk_import: 'Bulk import',
    referral: 'Referral',
    public_signup: 'Public signup',
  },
  status: {
    active: 'Active',
    inactive: 'Inactive',
    duplicate: 'Duplicate',
    unverified: 'Needs review',
    removed: 'Removed',
  },
  verification_status: {
    unverified: 'Unverified',
    verified: 'Verified',
    flagged: 'Flagged',
  },
  attribution_method: {
    qr_self_signup: 'Referred (QR)',
    staff_manual: 'Entered manually',
    staff_scan: 'Entered via scan',
    bulk_import: 'Imported',
    public_signup: 'Public signup',
  },
};

const TECHNICAL_AUDIT_FIELDS = new Set([ 'id', 'normalized_phone' ]);
const PRIMARY_AUDIT_FIELD_ORDER = [
  'verification_status',
  'status',
  'attribution_method',
  'source',
  'village_id',
  'precinct_id',
  'first_name',
  'last_name',
  'print_name',
  'contact_number',
  'email',
  'street_address',
  'registered_voter',
  'yard_sign',
  'motorcade_available',
  'opt_in_text',
  'opt_in_email',
  'dob',
];

function humanizeRole(role?: string) {
  return role ? role.replaceAll('_', ' ') : 'public/system';
}

function humanizeAuditValue(value: unknown, field?: string) {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') {
    if (field && AUDIT_VALUE_LABELS[field]?.[value]) {
      return AUDIT_VALUE_LABELS[field][value];
    }
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
    if (value.includes('_')) return value.replaceAll('_', ' ');
  }

  return String(value);
}

function auditFieldLabel(field: string) {
  return AUDIT_FIELD_LABELS[field] || field.replaceAll('_', ' ');
}

export default function SupporterDetailPage() {
  const { id } = useParams();
  const supporterId = Number(id);
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
  const villageNameById = useMemo(
    () => new Map(villages.map((village) => [ village.id, village.name ])),
    [villages]
  );
  const precinctNameById = useMemo(
    () => new Map(villages.flatMap((village) => village.precincts.map((precinct) => [ precinct.id, `${village.name} · ${precinct.number}` ]))),
    [villages]
  );

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
    return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">Loading supporter...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <UserRound className="w-5 h-5 text-primary" /> {supporter.first_name} {supporter.last_name}
        </h1>
        <p className="text-gray-500 text-sm">
          Signed up {formatDateTime(supporter.created_at)} · {supporter.source === 'qr_signup' ? 'Public Signup' : 'Staff Entry'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
            supporter.verification_status === 'verified' ? 'bg-green-100 text-green-800' :
            supporter.verification_status === 'flagged' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {supporter.verification_status === 'verified' ? 'Verified' :
             supporter.verification_status === 'flagged' ? 'Flagged' : 'Unverified'}
          </span>
          {supporter.status === 'removed' && (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
              Removed
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6">
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
                  className="text-sm text-primary hover:underline mt-1 inline-block"
                >
                  View possible match →
                </Link>
              )}
            </div>
          </div>
        )}

        <section className="app-card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-[var(--text-primary)]">Supporter Details</h2>
            {!isEditing ? (
              canEdit && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="bg-[var(--surface-raised)] border border-[var(--border-soft)] text-[var(--text-primary)] px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[var(--surface-bg)]"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              )
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-[var(--surface-raised)] border border-[var(--border-soft)] text-[var(--text-primary)] px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[var(--surface-bg)]"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveMutation.mutate(currentForm as Record<string, unknown>)}
                  disabled={saveMutation.isPending}
                  className="bg-primary text-white px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
          {!canEdit && !isEditing && (
            <p className="mb-3 text-xs text-[var(--text-secondary)] italic">
              View only — editing requires campaign admin or district coordinator role.
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <input
              value={String(currentForm.first_name || '')}
              onChange={(e) => updateDraft({ first_name: e.target.value })}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 disabled:bg-[var(--surface-bg)] disabled:text-[var(--text-primary)]"
              disabled={!isEditing}
              placeholder="First Name"
            />
            <input
              value={String(currentForm.last_name || '')}
              onChange={(e) => updateDraft({ last_name: e.target.value })}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 disabled:bg-[var(--surface-bg)] disabled:text-[var(--text-primary)]"
              disabled={!isEditing}
              placeholder="Last Name"
            />
            <input
              value={String(currentForm.contact_number || '')}
              onChange={(e) => updateDraft({ contact_number: e.target.value })}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 disabled:bg-[var(--surface-bg)] disabled:text-[var(--text-primary)]"
              disabled={!isEditing}
              placeholder="Phone Number"
            />
            <input
              value={String(currentForm.email || '')}
              onChange={(e) => updateDraft({ email: e.target.value })}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 disabled:bg-[var(--surface-bg)] disabled:text-[var(--text-primary)]"
              disabled={!isEditing}
              placeholder="Email"
            />
            <input
              type="date"
              value={String(currentForm.dob || '')}
              onChange={(e) => updateDraft({ dob: e.target.value })}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 disabled:bg-[var(--surface-bg)] disabled:text-[var(--text-primary)]"
              disabled={!isEditing}
            />
            <input
              value={String(currentForm.street_address || '')}
              onChange={(e) => updateDraft({ street_address: e.target.value })}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 md:col-span-2 disabled:bg-[var(--surface-bg)] disabled:text-[var(--text-primary)]"
              disabled={!isEditing}
              placeholder="Street Address"
            />
            <select
              value={String(currentForm.village_id || '')}
              onChange={(e) => updateDraft({ village_id: Number(e.target.value), precinct_id: null })}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] disabled:bg-[var(--surface-bg)] disabled:text-[var(--text-primary)]"
              disabled={!isEditing}
            >
              {villages.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <select
              value={currentForm.precinct_id ? String(currentForm.precinct_id) : ''}
              onChange={(e) => updateDraft({ precinct_id: e.target.value ? Number(e.target.value) : null })}
              className="border border-[var(--border-soft)] rounded-xl px-3 py-2 bg-[var(--surface-raised)] disabled:bg-[var(--surface-bg)] disabled:text-[var(--text-primary)]"
              disabled={!isEditing}
            >
              <option value="">Not assigned</option>
              {(selectedVillage?.precincts || []).map((p) => (
                <option key={p.id} value={p.id}>Precinct {p.number} ({p.alpha_range})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-4 mt-3 text-sm text-[var(--text-primary)]">
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
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[var(--border-soft)]">
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
          <h2 className="font-semibold text-[var(--text-primary)] mb-2">Verification</h2>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">Current status:</span>
              <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-semibold ${
                supporter.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                supporter.verification_status === 'flagged' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {supporter.verification_status === 'verified' ? 'Verified' :
                 supporter.verification_status === 'flagged' ? 'Flagged' : 'Unverified'}
              </span>
              {supporter.status === 'removed' && (
                <span className="inline-block px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-200 text-gray-700">
                  Removed
                </span>
              )}
            </div>

            {canEdit && (
              <>
                <p className="text-sm text-[var(--text-secondary)]">Change verification:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={supporter.verification_status === 'verified'}
                    onClick={async () => {
                      try {
                        await verifySupporter(supporter.id, 'verified');
                        refetch();
                      } catch {
                        alert('Failed to verify supporter. You may not have permission.');
                      }
                    }}
                    className="min-h-[40px] px-3.5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Set Verified
                  </button>
                  <button
                    type="button"
                    disabled={supporter.verification_status === 'flagged'}
                    onClick={async () => {
                      try {
                        await verifySupporter(supporter.id, 'flagged');
                        refetch();
                      } catch {
                        alert('Failed to flag supporter. You may not have permission.');
                      }
                    }}
                    className="min-h-[40px] px-3.5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Set Flagged
                  </button>
                  <button
                    type="button"
                    disabled={supporter.verification_status === 'unverified'}
                    onClick={async () => {
                      try {
                        await verifySupporter(supporter.id, 'unverified');
                        refetch();
                      } catch {
                        alert('Failed to reset verification. You may not have permission.');
                      }
                    }}
                    className="min-h-[40px] px-3.5 py-2 border border-[var(--border-soft)] text-[var(--text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--surface-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset Verification
                  </button>
                </div>

                <div className="pt-1">
                  {supporter.status !== 'removed' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Remove this supporter? They will be excluded from all counts but kept in the audit log.')) return;
                        try {
                          await updateSupporter(supporter.id, { status: 'removed' });
                          refetch();
                        } catch {
                          alert('Failed to remove supporter.');
                        }
                      }}
                      className="min-h-[40px] px-3.5 py-2 bg-red-50 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100"
                    >
                      Remove from active list
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateSupporter(supporter.id, { status: 'active' });
                          refetch();
                        } catch {
                          alert('Failed to restore supporter.');
                        }
                      }}
                      className="min-h-[40px] px-3.5 py-2 bg-blue-50 border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100"
                    >
                      Restore to active list
                    </button>
                  )}
                </div>
              </>
            )}

            {canEdit && (
              <p className="text-xs text-[var(--text-secondary)]">
                Only one verification status can be active at a time.
              </p>
            )}
          </div>
          {supporter.verified_at && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Last updated: {formatDateTime(supporter.verified_at)}
            </p>
          )}
        </section>

        <section className="app-card p-4">
          <h2 className="font-semibold text-[var(--text-primary)] mb-2">Engagement Snapshot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="border rounded-xl p-3">
              <div className="text-xl font-bold">{supporter.events_invited_count}</div>
              <div className="text-xs text-[var(--text-secondary)]">Invited</div>
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-xl font-bold">{supporter.events_attended_count}</div>
              <div className="text-xs text-[var(--text-secondary)]">Attended</div>
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-xl font-bold">{supporter.reliability_score ?? '—'}</div>
              <div className="text-xs text-[var(--text-secondary)]">Reliability</div>
            </div>
          </div>
        </section>

        <section className="app-card p-4">
          <div className="mb-3">
            <h2 className="font-semibold text-[var(--text-primary)]">Audit History ({auditLogs.length})</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Clear timeline of who changed this supporter, when it changed, and exactly what changed.
            </p>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No changes logged yet.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => {
                const changedFields = Object.entries(log.changed_data || {});
                const sortedChangedFields = [ ...changedFields ].sort(([a], [b]) => {
                  const aIdx = PRIMARY_AUDIT_FIELD_ORDER.indexOf(a);
                  const bIdx = PRIMARY_AUDIT_FIELD_ORDER.indexOf(b);
                  const normalizedA = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx;
                  const normalizedB = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx;
                  return normalizedA - normalizedB;
                });
                const primaryChanges = sortedChangedFields.filter(([field]) => !TECHNICAL_AUDIT_FIELDS.has(field));
                const technicalChanges = sortedChangedFields.filter(([field]) => TECHNICAL_AUDIT_FIELDS.has(field));
                const actionLabel = (log.action_label || log.action || 'Updated').replaceAll('_', ' ');
                const actorLabel = log.actor_name || 'System/Public';

                const renderAuditValue = (field: string, value: unknown) => {
                  if (value === null || value === undefined || value === '') return 'empty';
                  if (field === 'referral_code_id') {
                    const numericValue = Number(value);
                    if (
                      supporter.referral_code_id &&
                      Number.isFinite(numericValue) &&
                      numericValue === supporter.referral_code_id
                    ) {
                      const name = supporter.referral_display_name || 'Unknown referrer';
                      const code = supporter.leader_code;
                      return code ? `${name} (${code})` : name;
                    }
                    return `Referral #${numericValue}`;
                  }
                  if (field === 'leader_code') {
                    const codeValue = String(value);
                    if (supporter.leader_code && codeValue === supporter.leader_code && supporter.referral_display_name) {
                      return `${supporter.referral_display_name} (${codeValue})`;
                    }
                    return codeValue;
                  }
                  if (field === 'village_id') {
                    const mapped = villageNameById.get(Number(value));
                    if (mapped) return mapped;
                  }
                  if (field === 'precinct_id') {
                    const mapped = precinctNameById.get(Number(value));
                    if (mapped) return mapped;
                  }
                  return humanizeAuditValue(value, field);
                };

                return (
                  <details key={log.id} className="border border-[var(--border-soft)] rounded-xl bg-[var(--surface-raised)] group">
                    <summary className="cursor-pointer list-none p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-[var(--text-primary)]">{actionLabel}</p>
                          <p className="text-sm text-[var(--text-secondary)]">
                            Changed by <span className="font-medium text-[var(--text-primary)]">{actorLabel}</span> ({humanizeRole(log.actor_role)}) on {formatDateTime(log.created_at)}
                          </p>
                          {primaryChanges.length > 0 && (
                            <p className="text-sm text-[var(--text-secondary)] mt-1">
                              {auditFieldLabel(primaryChanges[0][0])}
                              {primaryChanges.length > 1 ? ` + ${primaryChanges.length - 1} more` : ''}
                            </p>
                          )}
                        </div>
                        <span className="text-xs rounded-full bg-[var(--surface-bg)] px-2 py-1 text-[var(--text-secondary)]">
                          {changedFields.length} change{changedFields.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2">Tap to expand details</p>
                    </summary>

                    <div className="px-4 pb-4 border-t border-[var(--border-soft)]">
                      {primaryChanges.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {primaryChanges.map(([field, diff]) => (
                            <div key={field} className="rounded-lg border border-[var(--border-soft)] bg-white px-3 py-2.5">
                              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{auditFieldLabel(field)}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-base">
                                <span className="rounded-md bg-gray-200 text-gray-900 px-2.5 py-1">{renderAuditValue(field, diff.from)}</span>
                                <span className="text-[var(--text-secondary)] font-medium">to</span>
                                <span className="rounded-md bg-blue-200 text-blue-900 px-2.5 py-1 font-medium">{renderAuditValue(field, diff.to)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-secondary)] mt-3">No user-facing field changes captured for this action.</p>
                      )}

                      {technicalChanges.length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-[var(--text-secondary)]">Show system details</summary>
                          <div className="mt-2 space-y-1">
                            {technicalChanges.map(([field, diff]) => (
                              <p key={field} className="text-xs text-[var(--text-secondary)]">
                                <span className="font-medium">{auditFieldLabel(field)}:</span>{' '}
                                {renderAuditValue(field, diff.from)} {'->'} {renderAuditValue(field, diff.to)}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
