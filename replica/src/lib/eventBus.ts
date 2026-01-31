// Simple in-memory event bus to simulate multi-client real-time sync
type Listener = (payload: any, meta?: { source?: string }) => void;

const listeners: Record<string, Listener[]> = {};
const instanceId = Math.random().toString(36).slice(2, 10);

export const eventBus = {
  instanceId,
  publish(event: string, payload: any, meta: { source?: string } = {}) {
    const list = listeners[event] || [];
    for (const l of list) {
      try { l(payload, meta); } catch (e) { console.error('eventBus listener error', e); }
    }
  },
  subscribe(event: string, listener: Listener) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(listener);
    return () => {
      listeners[event] = (listeners[event] || []).filter(l => l !== listener);
    };
  }
};

export default eventBus;
