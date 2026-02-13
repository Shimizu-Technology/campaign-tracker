import { useState, useCallback, useEffect, useRef } from 'react';
import type { CampaignEvent } from '../lib/cable';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning';
}

function eventToToast(event: CampaignEvent): { message: string; type: Toast['type'] } | null {
  const data = event?.data ?? {};

  switch (event.type) {
    case 'new_supporter':
      return {
        message: `New supporter: ${data.print_name ?? 'Unknown'} (${data.village_name ?? 'Unknown'})`,
        type: 'success',
      };
    case 'poll_report':
      return {
        message: `Precinct ${data.precinct_number ?? 'Unknown'}: ${data.voter_count ?? 0} voters (${data.turnout_pct ?? 0}%)`,
        type: 'info',
      };
    case 'event_check_in':
      return {
        message: `${data.supporter_name ?? 'Supporter'} checked in at ${data.event_name ?? 'event'}`,
        type: 'success',
      };
    default:
      return null;
  }
}

export function useRealtimeToast(maxToasts = 5) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current = [];
    };
  }, []);

  const handleEvent = useCallback((event: CampaignEvent) => {
    const toast = eventToToast(event);
    if (!toast) return;

    const id = ++idRef.current;
    setToasts(prev => [{ id, ...toast }, ...prev].slice(0, maxToasts));

    // Auto-remove after 5s
    const timeoutId = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
    timeoutIdsRef.current.push(timeoutId);
  }, [maxToasts]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, handleEvent, dismiss };
}
