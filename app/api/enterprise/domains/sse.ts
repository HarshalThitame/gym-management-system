const clients = new Map<string, Set<(data: string) => void>>();

export function notifyDomainCheck(domainId: string, data: Record<string, unknown>) {
  const listeners = clients.get(domainId);
  if (listeners) {
    const payload = JSON.stringify({ event: "check_complete", domainId, ...data });
    for (const send of listeners) {
      send(payload);
    }
  }
}

export function getSseClients() {
  return clients;
}
