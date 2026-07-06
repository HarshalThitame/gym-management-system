import { describe, expect, it } from "vitest";
import {
  appendQueuedLocationSample,
  compactQueuedLocationSamples,
  formatLocationSummary,
  isGeolocationPermissionDenied,
  queueKeyForMember,
  shouldSendLocationSample
} from "@/features/member/lib/location-tracking";

describe("member location tracking", () => {
  it("builds a stable queue key per member", () => {
    expect(queueKeyForMember("member-123")).toBe("member-location-report-queue:member-123");
  });

  it("deduplicates very close samples within the short reporting window", () => {
    expect(
      shouldSendLocationSample(
        { latitude: 19.1, longitude: 72.8, accuracyM: 12, recordedAt: "2026-07-06T10:00:00.000Z" },
        { latitude: 19.10005, longitude: 72.80005, accuracyM: 11, recordedAt: "2026-07-06T10:00:20.000Z" }
      )
    ).toBe(false);
  });

  it("reports movement after sufficient time or distance", () => {
    expect(
      shouldSendLocationSample(
        { latitude: 19.1, longitude: 72.8, accuracyM: 12, recordedAt: "2026-07-06T10:00:00.000Z" },
        { latitude: 19.2, longitude: 72.9, accuracyM: 11, recordedAt: "2026-07-06T10:02:00.000Z" }
      )
    ).toBe(true);
  });

  it("formats sample summaries safely", () => {
    expect(formatLocationSummary(null)).toBe("No location report yet.");
    expect(
      formatLocationSummary({
        latitude: 19.1,
        longitude: 72.8,
        accuracyM: 15,
        recordedAt: "2026-07-06T10:00:00.000Z"
      })
    ).toContain("±15m");
  });

  it("avoids adding duplicate queued samples that are too close together", () => {
    const queue = appendQueuedLocationSample([], {
      latitude: 19.1,
      longitude: 72.8,
      accuracyM: 15,
      recordedAt: "2026-07-06T10:00:00.000Z"
    }, "member-123", "session-1");

    const nextQueue = appendQueuedLocationSample(queue, {
      latitude: 19.10002,
      longitude: 72.80002,
      accuracyM: 14,
      recordedAt: "2026-07-06T10:00:15.000Z"
    }, "member-123", "session-1");

    expect(nextQueue).toHaveLength(1);
  });

  it("compacts an existing queue with near-identical samples", () => {
    const queue = compactQueuedLocationSamples([
      {
        id: "1",
        memberId: "member-123",
        sessionId: "session-1",
        latitude: 19.1,
        longitude: 72.8,
        accuracyM: 15,
        recordedAt: "2026-07-06T10:00:00.000Z"
      },
      {
        id: "2",
        memberId: "member-123",
        sessionId: "session-1",
        latitude: 19.10001,
        longitude: 72.80001,
        accuracyM: 14,
        recordedAt: "2026-07-06T10:00:10.000Z"
      },
      {
        id: "3",
        memberId: "member-123",
        sessionId: "session-1",
        latitude: 19.2,
        longitude: 72.9,
        accuracyM: 13,
        recordedAt: "2026-07-06T10:02:00.000Z"
      }
    ]);

    expect(queue).toHaveLength(2);
    expect(queue[1]?.id).toBe("3");
  });

  it("recognizes geolocation permission denied errors", () => {
    expect(isGeolocationPermissionDenied({ code: 1 })).toBe(true);
    expect(isGeolocationPermissionDenied({ code: 2 })).toBe(false);
    expect(isGeolocationPermissionDenied(new Error("nope"))).toBe(false);
  });
});
