import { describe, expect, it } from "vitest";
import { trainingRowsToCsv } from "@/features/training/lib/csv";
import {
  calculatePackageExpiry,
  minutesBetweenTimes,
  slugifyTrainingName,
  validateSessionStatusChange,
  validateSessionWindow
} from "@/features/training/lib/business-rules";
import { PtPackageSchema, TrainerSessionSchema } from "@/features/training/schemas/training";
import type { TrainerSessionRow } from "@/types/training";

const trainerId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";

describe("training business rules", () => {
  it("creates URL-safe package slugs", () => {
    expect(slugifyTrainingName("  Elite PT: 12 Sessions! ")).toBe("elite-pt-12-sessions");
  });

  it("calculates inclusive PT package expiry dates", () => {
    expect(calculatePackageExpiry("2026-06-10", 30)).toBe("2026-07-09");
  });

  it("validates practical session durations", () => {
    expect(minutesBetweenTimes("2026-06-10", "07:00", "08:15")).toBe(75);
    expect(validateSessionWindow("2026-06-10", "07:00", "07:10")).toContain("at least");
    expect(validateSessionWindow("2026-06-10", "07:00", "08:00")).toBeNull();
  });

  it("enforces session status workflows", () => {
    expect(validateSessionStatusChange("scheduled", "completed")).toBeNull();
    expect(validateSessionStatusChange("completed", "cancelled")).toContain("Cannot move");
    expect(validateSessionStatusChange("cancelled", "rescheduled")).toBeNull();
  });
});

describe("training schemas", () => {
  it("normalizes PT package money values", () => {
    const parsed = PtPackageSchema.parse({
      name: "Elite Coaching",
      description: "Twelve focused personal training sessions.",
      sessionCount: "12",
      validityDays: "90",
      priceAmount: "18000",
      status: "active",
      isPublic: true,
      displayOrder: "10"
    });

    expect(parsed.priceAmount).toBe(1_800_000);
  });

  it("requires valid members and trainer IDs for sessions", () => {
    const parsed = TrainerSessionSchema.safeParse({
      trainerId,
      memberId,
      sessionDate: "2026-06-10",
      startsAt: "07:00",
      endsAt: "08:00",
      workoutType: "Strength coaching"
    });

    expect(parsed.success).toBe(true);
  });
});

describe("training CSV reports", () => {
  it("exports session report rows", () => {
    const row: TrainerSessionRow = {
      id: "session-1",
      gym_id: "gym-1",
      branch_id: null,
      trainer_id: trainerId,
      member_id: memberId,
      member_pt_package_id: null,
      workout_program_id: null,
      session_date: "2026-06-10",
      starts_at: "07:00:00",
      ends_at: "08:00:00",
      duration_minutes: 60,
      status: "scheduled",
      workout_type: "Strength coaching",
      notes: null,
      completion_notes: null,
      cancel_reason: null,
      created_by: null,
      completed_at: null,
      cancelled_at: null,
      created_at: "2026-06-10T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z"
    };

    expect(trainingRowsToCsv({ type: "sessions", rows: [row] })).toContain("session-1");
    expect(trainingRowsToCsv({ type: "sessions", rows: [row] })).toContain("Strength coaching");
  });
});
