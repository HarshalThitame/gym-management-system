const clients = new Map<string, Set<(data: string) => void>>();

export function notifyTicketUpdate(ticketId: string, event: string, data: Record<string, unknown>) {
  const listeners = clients.get(ticketId);
  if (listeners) {
    const payload = JSON.stringify({ event, ticketId, ...data, timestamp: new Date().toISOString() });
    for (const send of listeners) {
      send(payload);
    }
  }
}

export function notifySupportEvent(channel: string, data: Record<string, unknown>) {
  for (const [key, listeners] of clients) {
    if (key.startsWith(`channel:${channel}`)) {
      const payload = JSON.stringify({ event: "broadcast", channel, ...data, timestamp: new Date().toISOString() });
      for (const send of listeners) {
        send(payload);
      }
    }
  }
}

export function addClient(key: string, send: (data: string) => void) {
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key)!.add(send);
}

export function removeClient(key: string, send: (data: string) => void) {
  const listeners = clients.get(key);
  if (listeners) {
    listeners.delete(send);
    if (listeners.size === 0) clients.delete(key);
  }
}
