"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import { bookClassAction } from "@/features/classes/actions/class-actions";
import type { ClassSessionWithClass } from "@/types/classes";
import type { MemberDirectoryItem } from "@/types/membership";

export function ReceptionClassBookingForm({ members, session }: { members: MemberDirectoryItem[]; session: ClassSessionWithClass }) {
  const [state, formAction] = useActionState(bookClassAction, initialAuthActionState);
  const availableSeats = Math.max(session.capacity - session.reserved_capacity - session.booked_count, 0);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <input name="sessionId" type="hidden" value={session.id} />
      <select
        aria-label={`Member for ${session.class?.name ?? "class"} booking`}
        className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm"
        name="memberId"
        required
      >
        <option value="">Select member</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>{member.full_name} ({member.member_code})</option>
        ))}
      </select>
      <Button className="w-full" disabled={members.length === 0} type="submit" variant={availableSeats > 0 ? "accent" : "secondary"}>
        {availableSeats > 0 ? "Book Member" : "Join Waitlist"}
      </Button>
    </form>
  );
}
