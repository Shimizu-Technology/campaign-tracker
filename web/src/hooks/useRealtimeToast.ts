import { useState, useCallback, useRef } from 'react';
import type { CampaignEvent } from '../lib/cable';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning';
}

function eventToToast(event: CampaignEvent): { message: string; type: Toast['type'] } | null {
  switch (event.type) {
    case 'new_supporter':
      return {
        message: `New supporter: ${event.data.print_name} (${event.data.village_name})`,
        type: 'success',
      };
    case 'poll_report':
      return {
        message: `📊 Precinct ${event.data.precinct_number}: ${event.data.voter_count} voters (${event.data.turnout_pct}%)`,
        type: 'info',
      };
    case 'event_check_in':
      return {
        message: `✅ ${event.data.supporter_name} checked in at ${event.data.event_name}`,
        type: 'success',
      };
    default:
      return null;
  }
}

export function useRealtimeToast(maxToasts = 5) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const handleEvent = useCallback((event: CampaignEvent) => {
    const toast = eventToToast(event);
    if (!toast) return;

    const id = ++idRef.current;
    setToasts(prev => [{ id, ...toast }, ...prev].slice(0, maxToasts));

    // Auto-remove after 5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, [maxToasts]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, handleEvent, dismiss };
}
