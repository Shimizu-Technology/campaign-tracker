import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target, Plus, Pencil, Trash2, Calendar, X } from 'lucide-react';
import { getVillages } from '../../lib/api';
import {
  useSprintGoals,
  useCreateSprintGoal,
  useUpdateSprintGoal,
  useDeleteSprintGoal,
} from '../../hooks/useSprintGoals';

interface SprintGoal {
  id: number;
  campaign_id: number;
  village_id: number | null;
  village_name: string | null;
  title: string;
  target_count: number;
  current_count: number;
  start_date: string;
  end_date: string;
  period_type: string;
  status: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

interface Village {
  id: number;
  name: string;
}

type TabStatus = 'active' | 'completed' | 'expired';

const emptyForm = {
  title: '',
  village_id: '' as string | number,
  target_count: '',
  start_date: '',
  end_date: '',
  period_type: 'custom',
};

function progressColor(pct: number) {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function daysRemaining(endDate: string) {
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Expired';
  if (diff === 0) return 'Last day';
  return `${diff} day${diff === 1 ? '' : 's'} left`;
}

export default function SprintGoalsPage() {
  const [tab, setTab] = useState<TabStatus>('active');
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SprintGoal | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useSprintGoals({ status: tab });
  const { data: villagesData } = useQuery<Village[]>({
    queryKey: ['villages'],
    queryFn: getVillages,
  });
  const createMutation = useCreateSprintGoal();
  const updateMutation = useUpdateSprintGoal();
  const deleteMutation = useDeleteSprintGoal();

  const goals: SprintGoal[] = data?.sprint_goals || [];
  const villages: Village[] = Array.isArray(villagesData) ? villagesData : [];

  function openCreate() {
    setEditingGoal(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(goal: SprintGoal) {
    setEditingGoal(goal);
    setForm({
      title: goal.title,
      village_id: goal.village_id || '',
      target_count: String(goal.target_count),
      start_date: goal.start_date,
      end_date: goal.end_date,
      period_type: goal.period_type,
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      village_id: form.village_id || null,
      target_count: Number(form.target_count),
      start_date: form.start_date,
      end_date: form.end_date,
      period_type: form.period_type,
    };

    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data: payload }, {
        onSuccess: () => { setShowForm(false); setEditingGoal(null); },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { setShowForm(false); setForm(emptyForm); },
      });
    }
  }

  function handleDelete(id: number) {
    if (confirm('Delete this sprint goal?')) {
      deleteMutation.mutate(id);
    }
  }

  const tabs: { key: TabStatus; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'expired', label: 'Expired' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Sprint Goals</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Short-term push targets per village</p>
        </div>
        <button onClick={openCreate} className="app-btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Goal
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--surface-overlay)] rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="app-card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {editingGoal ? 'Edit Sprint Goal' : 'New Sprint Goal'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="app-input w-full"
                  placeholder="e.g., Push 50 supporters in Dededo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Village (optional)</label>
                <select
                  value={form.village_id}
                  onChange={(e) => setForm({ ...form, village_id: e.target.value ? Number(e.target.value) : '' })}
                  className="app-input w-full"
                >
                  <option value="">Campaign-wide</option>
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Target Count</label>
                <input
                  type="number"
                  value={form.target_count}
                  onChange={(e) => setForm({ ...form, target_count: e.target.value })}
                  className="app-input w-full"
                  min="1"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="app-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="app-input w-full"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Period Type</label>
                <select
                  value={form.period_type}
                  onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                  className="app-input w-full"
                >
                  <option value="custom">Custom</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="app-btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingGoal ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goals List */}
      {isLoading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--surface-overlay)] flex items-center justify-center">
            <Target className="w-7 h-7 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">No {tab} goals</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {tab === 'active' ? 'Create a sprint goal to get started.' : `No ${tab} goals found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id} className="app-card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-[15px]">{goal.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                    <span>{goal.village_name || 'Campaign-wide'}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {daysRemaining(goal.end_date)}
                    </span>
                    <span className="capitalize">{goal.period_type}</span>
                  </div>
                </div>
                {tab === 'active' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(goal)} className="p-1.5 rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-muted)]">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(goal.id)} className="p-1.5 rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-muted)]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-[var(--text-secondary)] font-medium tabular-nums">
                  {goal.current_count} / {goal.target_count}
                </span>
                <span className={`font-semibold tabular-nums ${
                  goal.progress_percentage >= 75 ? 'text-emerald-400' :
                  goal.progress_percentage >= 50 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {goal.progress_percentage}%
                </span>
              </div>
              <div className="w-full bg-[var(--surface-overlay)] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${progressColor(goal.progress_percentage)}`}
                  style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
