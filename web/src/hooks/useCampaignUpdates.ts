import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToCampaign, type CampaignEvent, type CampaignEventType } from '../lib/cable';

/**
 * Hook that subscribes to real-time campaign updates and
 * automatically invalidates the relevant TanStack Query caches.
 *
 * Usage: just call useCampaignUpdates() in any admin page.
 * Optionally pass an onEvent callback for custom handling (e.g. toast notifications).
 */
export function useCampaignUpdates(onEvent?: (event: CampaignEvent) => void) {
  const queryClient = useQueryClient();

  const handleEvent = useCallback((event: CampaignEvent) => {
    // Invalidate relevant queries based on event type
    const invalidations: Record<CampaignEventType, string[]> = {
      new_supporter: ['dashboard', 'supporters', 'war_room', 'leaderboard'],
      poll_report: ['war_room', 'poll_watcher', 'dashboard'],
      event_check_in: ['events', 'war_room', 'dashboard'],
      stats_update: ['dashboard', 'war_room'],
    };

    const keys = invalidations[event.type] || [];
    keys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });

    // Call custom handler if provided
    onEvent?.(event);
  }, [queryClient, onEvent]);

  useEffect(() => {
    const unsubscribe = subscribeToCampaign(handleEvent);
    return unsubscribe;
  }, [handleEvent]);
}
