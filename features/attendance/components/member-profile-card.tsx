"use client";

import { CheckCircle2, Clock, Phone, User, XCircle } from "lucide-react";
import type { MemberRow } from "@/types/membership";
import type { MembershipRow } from "@/types/membership";

type MemberSummary = Pick<MemberRow, "id" | "full_name" | "member_code" | "phone" | "email" | "photo_url" | "gender" | "last_attendance_date" | "is_currently_in_gym">;

type MemberProfileCardProps = {
  member: MemberSummary;
  membership?: Pick<MembershipRow, "status" | "start_date" | "end_date"> | null;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  compact?: boolean;
};

export function MemberProfileCard({ member, membership, onCheckIn, onCheckOut, compact = false }: MemberProfileCardProps) {
  const membershipStatus = membership?.status ?? null;
  const membershipActive = membershipStatus === "active";
  const membershipExpired = membershipStatus === "expired";
  const membershipPending = membershipStatus === "pending" || membershipStatus === "frozen" || membershipStatus === "suspended";

  const statusLabel = member.is_currently_in_gym ? "Inside" : membershipActive ? "Active" : membershipExpired ? "Expired" : membershipPending ? "Restricted" : "No Plan";
  const statusVariant = member.is_currently_in_gym ? "success" : membershipActive ? "success" : membershipExpired ? "error" : "warning";

  return (
    <div className={`rounded-xl border ${compact ? "p-3" : "p-5"} ${member.is_currently_in_gym ? "border-success/20 bg-success/[0.03]" : "border-border bg-surface"}`}>
      <div className="flex items-start gap-4">
        <div className={`flex shrink-0 items-center justify-center rounded-full ${compact ? "size-10" : "size-14"} ${member.photo_url ? "" : "bg-surface-muted"}`}>
          {member.photo_url ? (
            <img alt="" className={`${compact ? "size-10" : "size-14"} rounded-full object-cover`} src={member.photo_url} />
          ) : (
            <User className={`${compact ? "size-5" : "size-6"} text-muted-foreground`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`truncate font-black ${compact ? "text-base" : "text-xl"}`}>{member.full_name}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              statusVariant === "success" ? "bg-success/15 text-success" :
              statusVariant === "error" ? "bg-destructive/15 text-destructive" :
              "bg-warning/15 text-warning"
            }`}>
              {statusVariant === "success" ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
              {statusLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
            {member.member_code} · {member.phone}
          </p>
          {member.last_attendance_date && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="size-3" />
              Last visit: {new Date(member.last_attendance_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
          {membership && (
            <div className={`mt-2 flex flex-wrap gap-3 ${compact ? "text-xs" : "text-sm"}`}>
              <span className="font-semibold text-muted-foreground">
                <Phone className="mr-1 inline size-3" />
                {member.phone}
              </span>
              {membership.end_date && (
                <span className={`font-semibold ${new Date(membership.end_date) < new Date() ? "text-destructive" : "text-muted-foreground"}`}>
                  Expires: {new Date(membership.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {!compact && (onCheckIn || onCheckOut) && (
        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          {onCheckIn && !member.is_currently_in_gym && (
            <button
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              disabled={!membershipActive && !membershipPending}
              onClick={onCheckIn}
              type="button"
            >
              Check In
            </button>
          )}
          {onCheckOut && member.is_currently_in_gym && (
            <button
              className="flex-1 rounded-lg border-2 border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-bold text-destructive transition hover:bg-destructive/20"
              onClick={onCheckOut}
              type="button"
            >
              Check Out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
