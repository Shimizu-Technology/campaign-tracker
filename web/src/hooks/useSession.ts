import { useQuery } from '@tanstack/react-query';
import { getSession } from '../lib/api';

export interface SessionResponse {
  user: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    assigned_village_id: number | null;
    assigned_district_id: number | null;
    assigned_block_id: number | null;
    scoped_village_ids: number[] | null;
  };
  counts: {
    pending_vetting: number;
  };
  permissions: {
    can_manage_users: boolean;
    can_manage_configuration: boolean;
    can_send_sms: boolean;
    can_edit_supporters: boolean;
    can_view_supporters: boolean;
    can_create_staff_supporters: boolean;
    can_access_events: boolean;
    can_access_qr: boolean;
    can_access_leaderboard: boolean;
    can_access_war_room: boolean;
    can_access_poll_watcher: boolean;
    manageable_roles: string[];
  };
}

export function useSession() {
  return useQuery<SessionResponse>({
    queryKey: ['session'],
    queryFn: getSession,
    staleTime: 60_000,
  });
}
