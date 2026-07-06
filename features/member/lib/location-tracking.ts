export type MemberLocationSample = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
};

export type QueuedMemberLocationSample = MemberLocationSample & {
  id: string;
  memberId: string;
  sessionId: string | null;
};

export type LocationTrackerStatus = "idle" | "requesting" | "tracking" | "offline" | "permission_denied" | "unsupported" | "error";

export function queueKeyForMember(memberId: string) {
  return `member-location-report-queue:${memberId}`;
}

export function shouldSendLocationSample(previous: MemberLocationSample | null, current: MemberLocationSample) {
  if (!previous) {
    return true;
  }

  const lastAt = new Date(previous.recordedAt).getTime();
  const currentAt = new Date(current.recordedAt).getTime();
  if (!Number.isFinite(lastAt) || !Number.isFinite(currentAt)) {
    return true;
  }

  const elapsedMs = currentAt - lastAt;
  const distanceMeters = haversineDistanceMeters(
    { latitude: previous.latitude, longitude: previous.longitude },
    { latitude: current.latitude, longitude: current.longitude }
  );

  return elapsedMs >= 45_000 || distanceMeters >= 20;
}

export function appendQueuedLocationSample(
  queue: QueuedMemberLocationSample[],
  sample: MemberLocationSample,
  memberId: string,
  sessionId: string | null
) {
  const previous = queue.at(-1) ?? null;
  if (previous && !shouldSendLocationSample(previous, sample)) {
    return queue;
  }

  return [
    ...queue,
    {
      ...sample,
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      memberId,
      sessionId
    }
  ];
}

export function compactQueuedLocationSamples(queue: QueuedMemberLocationSample[]) {
  if (queue.length <= 1) {
    return queue;
  }

  const compacted: QueuedMemberLocationSample[] = [queue[0]];
  for (const sample of queue.slice(1)) {
    const previous = compacted.at(-1) ?? null;
    if (previous && !shouldSendLocationSample(previous, sample)) {
      continue;
    }

    compacted.push(sample);
  }

  return compacted;
}

export function formatLocationSummary(sample: MemberLocationSample | null) {
  if (!sample) {
    return "No location report yet.";
  }

  const accuracyText = sample.accuracyM ? `±${Math.round(sample.accuracyM)}m` : "accuracy unavailable";
  return `${new Date(sample.recordedAt).toLocaleTimeString("en-IN")} · ${accuracyText}`;
}

function haversineDistanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadiusMeters = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const hav = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(hav));
}

export function isGeolocationPermissionDenied(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (!("code" in error)) {
    return false;
  }

  return Number((error as { code?: unknown }).code) === 1;
}
