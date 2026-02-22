import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSprintGoals, createSprintGoal, updateSprintGoal, deleteSprintGoal } from '../lib/api';

export interface SprintGoal {
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

export function useSprintGoals(status?: string) {
  return useQuery<SprintGoal[]>({
    queryKey: ['sprint_goals', status],
    queryFn: () => getSprintGoals(status ? { status } : undefined),
    retry: (failureCount, error) => {
      const s = (error as { response?: { status?: number } })?.response?.status;
      if (s === 401 || s === 403) return false;
      return failureCount < 1;
    },
  });
}

export function useCreateSprintGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createSprintGoal(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprint_goals'] }),
  });
}

export function useUpdateSprintGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => updateSprintGoal(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprint_goals'] }),
  });
}

export function useDeleteSprintGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSprintGoal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprint_goals'] }),
  });
}
