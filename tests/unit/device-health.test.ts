import { describe, expect, it } from "vitest";
import {
  formatDeviceFreshness,
  getDeviceHealthSnapshot,
  getDeviceHealthSummary,
} from "@/features/organization-owner/lib/device-health";

describe("device health helpers", () => {
  it("marks a recent online device as healthy", () => {
    const now = new Date("2026-07-05T10:00:00.000Z");
    const snapshot = getDeviceHealthSnapshot({ status: "online", last_seen_at: "2026-07-05T09:58:30.000Z" }, now);

    expect(snapshot.level).toBe("healthy");
    expect(snapshot.isStale).toBe(false);
    expect(formatDeviceFreshness(snapshot)).toBe("Seen 2m ago");
  });

  it("flags older devices as stale or critical", () => {
    const now = new Date("2026-07-05T10:00:00.000Z");
    const stale = getDeviceHealthSnapshot({ status: "online", last_seen_at: "2026-07-05T09:40:00.000Z" }, now);
    const critical = getDeviceHealthSnapshot({ status: "offline", last_seen_at: "2026-07-05T06:30:00.000Z" }, now);

    expect(stale.level).toBe("watch");
    expect(critical.level).toBe("critical");
    expect(critical.isStale).toBe(true);
    expect(formatDeviceFreshness(critical)).toBe("Seen 3h ago");
  });

  it("summarizes fleet health counts", () => {
    const now = new Date("2026-07-05T10:00:00.000Z");
    const summary = getDeviceHealthSummary([
      { status: "online", last_seen_at: "2026-07-05T09:58:00.000Z" },
      { status: "pending", last_seen_at: null },
      { status: "quarantined", last_seen_at: "2026-07-05T09:40:00.000Z" },
      { status: "offline", last_seen_at: "2026-07-05T09:40:00.000Z" },
      { status: "error", last_seen_at: "2026-07-05T08:00:00.000Z" },
      { status: "decommissioned", last_seen_at: null },
    ], now);

    expect(summary.healthy).toBe(1);
    expect(summary.watch).toBe(1);
    expect(summary.critical).toBe(1);
    expect(summary.decommissioned).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.quarantined).toBe(1);
    expect(summary.totalMonitored).toBe(5);
  });
});
