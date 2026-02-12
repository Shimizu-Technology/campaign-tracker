import { createConsumer } from '@rails/actioncable';

// Connect to ActionCable on the Rails API
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/cable';

const consumer = createConsumer(WS_URL);

export type CampaignEventType = 'new_supporter' | 'poll_report' | 'event_check_in' | 'stats_update';

export interface CampaignEvent {
  type: CampaignEventType;
  data: any;
  timestamp: string;
}

export type CampaignEventHandler = (event: CampaignEvent) => void;

/**
 * Subscribe to the CampaignChannel for real-time updates.
 * Returns an unsubscribe function.
 */
export function subscribeToCampaign(onEvent: CampaignEventHandler): () => void {
  const subscription = consumer.subscriptions.create('CampaignChannel', {
    connected() {
      console.log('[Cable] Connected to CampaignChannel');
    },
    disconnected() {
      console.log('[Cable] Disconnected from CampaignChannel');
    },
    received(event: CampaignEvent) {
      console.log('[Cable] Event:', event.type, event.data);
      onEvent(event);
    },
  });

  return () => {
    subscription.unsubscribe();
  };
}

export default consumer;
