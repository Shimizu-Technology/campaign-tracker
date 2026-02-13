import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Home, Pencil, Save, UserRound, X } from 'lucide-react';
import { getSupporter, getVillages, updateSupporter } from '../../lib/api';

interface VillageOption {
  id: number;
  name: string;
  precincts: { id: number; number: string; alpha_range: string }[];
}

interface SupporterDetail {
  id: number;
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
  actor_name?: string;
  changed_data: Record<string, unknown>;
  created_at: string;
}

export default function SupporterDetailPage() {
  const { id } = useParams();
  const supporterId = Number(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return_to') || '/admin/supporters';
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['supporter', supporterId],
    queryFn: () => getSupporter(supporterId),
    enabled: Number.isFinite(supporterId),
  });
  const { data: villagesData } = useQuery({
    queryKey: ['villages'],
    queryFn: getVillages,
  });

  const supporter: SupporterDetail | undefined = data?.supporter;
  const auditLogs: AuditLogItem[] = data?.audit_logs || [];
  const villages: VillageOption[] = useMemo(() => villagesData?.villages || [], [villagesData]);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<SupporterDetail> | null>(null);

  const baseForm = useMemo(() => {
    if (!supporter) return null;
    return {
      print_name: supporter.print_name,
      contact_number: supporter.contact_number,
      email: supporter.email || '',
      dob: supporter.dob || '',
      street_address: supporter.street_address || '',
      village_id: supporter.village_id,
      precinct_id: supporter.precinct_id,
      registered_voter: supporter.registered_voter,
      yard_sign: supporter.yard_sign,
      motorcade_available: supporter.motorcade_available,
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
    <div className="min-h-screen bg-gray-50">
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
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserRound className="w-5 h-5" /> {supporter.print_name}
          </h1>
          <p className="text-blue-200 text-sm">
            Signed up {new Date(supporter.created_at).toLocaleString()} · {supporter.source === 'qr_signup' ? 'Public Signup' : 'Staff Entry'}
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-gray-900">Supporter Details</h2>
            {!isEditing ? (
              <button
                type="button"
                onClick={startEdit}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-white border border-gray-300 text-gray-700 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveMutation.mutate(currentForm as Record<string, unknown>)}
                  disabled={saveMutation.isPending}
                  className="bg-[#1B3A6B] text-white px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              value={String(currentForm.print_name || '')}
              onChange={(e) => updateDraft({ print_name: e.target.value })}
              className="border rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="Full Name"
            />
            <input
              value={String(currentForm.contact_number || '')}
              onChange={(e) => updateDraft({ contact_number: e.target.value })}
              className="border rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="Phone Number"
            />
            <input
              value={String(currentForm.email || '')}
              onChange={(e) => updateDraft({ email: e.target.value })}
              className="border rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="Email"
            />
            <input
              type="date"
              value={String(currentForm.dob || '')}
              onChange={(e) => updateDraft({ dob: e.target.value })}
              className="border rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
            />
            <input
              value={String(currentForm.street_address || '')}
              onChange={(e) => updateDraft({ street_address: e.target.value })}
              className="border rounded-lg px-3 py-2 md:col-span-2 disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
              placeholder="Street Address"
            />
            <select
              value={String(currentForm.village_id || '')}
              onChange={(e) => updateDraft({ village_id: Number(e.target.value), precinct_id: null })}
              className="border rounded-lg px-3 py-2 bg-white disabled:bg-gray-50 disabled:text-gray-700"
              disabled={!isEditing}
            >
              {villages.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <select
              value={currentForm.precinct_id ? String(currentForm.precinct_id) : ''}
              onChange={(e) => updateDraft({ precinct_id: e.target.value ? Number(e.target.value) : null })}
              className="border rounded-lg px-3 py-2 bg-white disabled:bg-gray-50 disabled:text-gray-700"
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
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Engagement Snapshot</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border rounded-lg p-3">
              <div className="text-xl font-bold">{supporter.events_invited_count}</div>
              <div className="text-xs text-gray-500">Invited</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xl font-bold">{supporter.events_attended_count}</div>
              <div className="text-xs text-gray-500">Attended</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xl font-bold">{supporter.reliability_score ?? '—'}</div>
              <div className="text-xs text-gray-500">Reliability</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Audit History</h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No changes logged yet.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900">
                    {log.action} by {log.actor_name || 'System/Public'}
                  </div>
                  <div className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
