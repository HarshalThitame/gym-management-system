"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { ClassBookingRow, ClassCategoryRow, ClassRow, ClassSessionWithClass } from "@/types/classes";
import type { TrainerRow } from "@/types/training";
import {
  bookClassAction,
  cancelClassBookingAction,
  deleteClassAction,
  generateClassScheduleAction,
  recordClassAttendanceAction,
  saveClassAction,
  saveClassCategoryAction,
  saveClassSessionAction,
  updateClassSessionStatusAction
} from "../actions/class-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function ClassCategoryForm() {
  const [state, formAction] = useActionState(saveClassCategoryAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <Field id="category-name" label="Name" name="name" state={state}><Input id="category-name" name="name" placeholder="Mobility Workshop" /></Field>
      <Field id="category-description" label="Description" name="description" state={state}><Textarea id="category-description" name="description" placeholder="Describe this class category" /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="category-color-token" label="Color" name="colorToken" state={state}><Input id="category-color-token" name="colorToken" defaultValue="accent" /></Field>
        <select className={selectClass} name="status" defaultValue="active" aria-label="Category status">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <Field id="category-display-order" label="Order" name="displayOrder" state={state}><Input id="category-display-order" name="displayOrder" defaultValue="100" type="number" /></Field>
      </div>
      <AuthSubmitButton>Save Category</AuthSubmitButton>
    </form>
  );
}

export function ClassForm({ categories, trainers }: { categories: ClassCategoryRow[]; trainers: TrainerRow[] }) {
  const [state, formAction] = useActionState(saveClassAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="class-name" label="Class name" name="name" state={state}><Input id="class-name" name="name" placeholder="Signature Strength Club" /></Field>
        <select className={selectClass} name="categoryId" defaultValue="" aria-label="Class category">
          <option value="">No category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>
      <Field id="class-description" label="Description" name="description" state={state}><Textarea id="class-description" name="description" placeholder="Production-ready class description" /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <select className={selectClass} name="primaryTrainerId" defaultValue="" aria-label="Primary trainer">
          <option value="">No trainer</option>
          {trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.display_name}</option>)}
        </select>
        <select className={selectClass} name="classType" defaultValue="group_class" aria-label="Class type">
          <option value="group_class">Group class</option>
          <option value="workshop">Workshop</option>
          <option value="special_event">Special event</option>
          <option value="challenge">Challenge</option>
          <option value="camp">Camp</option>
          <option value="group_pt">Group PT</option>
        </select>
        <select className={selectClass} name="difficulty" defaultValue="all_levels" aria-label="Difficulty">
          <option value="all_levels">All levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Field id="class-duration-minutes" label="Duration" name="durationMinutes" state={state}><Input id="class-duration-minutes" name="durationMinutes" defaultValue="60" type="number" /></Field>
        <Field id="class-default-capacity" label="Capacity" name="defaultCapacity" state={state}><Input id="class-default-capacity" name="defaultCapacity" defaultValue="24" type="number" /></Field>
        <Field id="class-reserved-capacity" label="Reserved" name="reservedCapacity" state={state}><Input id="class-reserved-capacity" name="reservedCapacity" defaultValue="0" type="number" /></Field>
        <Field id="class-price-amount" label="Price" name="priceAmount" state={state}><Input id="class-price-amount" name="priceAmount" defaultValue="0" type="number" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Field id="class-booking-window-days" label="Booking window" name="bookingWindowDays" state={state}><Input id="class-booking-window-days" name="bookingWindowDays" defaultValue="14" type="number" /></Field>
        <Field id="class-cancellation-window-hours" label="Cancel window" name="cancellationWindowHours" state={state}><Input id="class-cancellation-window-hours" name="cancellationWindowHours" defaultValue="4" type="number" /></Field>
        <select className={selectClass} name="membershipAccess" defaultValue="active_members" aria-label="Membership access">
          <option value="active_members">Active members</option>
          <option value="premium_only">Premium only</option>
          <option value="staff_approval">Staff approval</option>
          <option value="public_event">Public event</option>
        </select>
        <select className={selectClass} name="status" defaultValue="active" aria-label="Class status">
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <Input name="location" placeholder="Studio A, turf lane, rooftop deck" />
      <Textarea name="requirements" placeholder="Equipment, clothing, prerequisites, approvals" />
      <label className="flex items-center gap-2 text-sm font-bold"><input name="requiresApproval" type="checkbox" /> Requires staff approval</label>
      <AuthSubmitButton>Save Class</AuthSubmitButton>
    </form>
  );
}

export function ClassScheduleForm({ classes }: { classes: ClassRow[] }) {
  const [state, formAction] = useActionState(generateClassScheduleAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="classId" defaultValue={classes[0]?.id ?? ""} aria-label="Class">
        {classes.map((classRow) => <option key={classRow.id} value={classRow.id}>{classRow.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-3">
        <select className={selectClass} name="recurrence" defaultValue="weekly" aria-label="Recurrence">
          <option value="one_time">One time</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom weekly</option>
        </select>
        <Input name="startDate" type="date" />
        <Input name="endDate" type="date" />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <Input name="startsAt" type="time" defaultValue="07:00" />
        <Input name="endsAt" type="time" defaultValue="08:00" />
        <Input name="dayOfWeek" type="number" min="0" max="6" placeholder="Day 0-6" />
        <Input name="dayOfMonth" type="number" min="1" max="31" placeholder="Day of month" />
        <Input name="capacityOverride" type="number" placeholder="Capacity override" />
      </div>
      <Textarea name="notes" placeholder="Schedule notes, holiday handling, trainer leave context" />
      <AuthSubmitButton>Generate Sessions</AuthSubmitButton>
    </form>
  );
}

export function ClassSessionForm({ classes, trainers }: { classes: ClassRow[]; trainers: TrainerRow[] }) {
  const [state, formAction] = useActionState(saveClassSessionAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="classId" defaultValue={classes[0]?.id ?? ""} aria-label="Class">
        {classes.map((classRow) => <option key={classRow.id} value={classRow.id}>{classRow.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-2">
        <select className={selectClass} name="primaryTrainerId" defaultValue="" aria-label="Primary trainer">
          <option value="">Class primary trainer</option>
          {trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.display_name}</option>)}
        </select>
        <select className={selectClass} name="substituteTrainerId" defaultValue="" aria-label="Substitute trainer">
          <option value="">No substitute</option>
          {trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.display_name}</option>)}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <Input name="sessionDate" type="date" />
        <Input name="startsAt" type="time" defaultValue="07:00" />
        <Input name="endsAt" type="time" defaultValue="08:00" />
        <Input name="capacity" type="number" defaultValue="24" />
        <Input name="reservedCapacity" type="number" defaultValue="0" />
      </div>
      <Input name="location" placeholder="Studio A" />
      <Textarea name="notes" placeholder="Session notes" />
      <AuthSubmitButton>Create Session</AuthSubmitButton>
    </form>
  );
}

export function BookClassForm({ session, memberId = "" }: { session: ClassSessionWithClass; memberId?: string }) {
  const [state, formAction] = useActionState(bookClassAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="sessionId" suppressHydrationWarning type="hidden" value={session.id} />
      {memberId ? <input name="memberId" suppressHydrationWarning type="hidden" value={memberId} /> : null}
      <Button className="w-full" type="submit" variant="accent">Book Class</Button>
    </form>
  );
}

export function CancelClassBookingForm({ bookingId }: { bookingId: string }) {
  const [state, formAction] = useActionState(cancelClassBookingAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="bookingId" suppressHydrationWarning type="hidden" value={bookingId} />
      <Input name="reason" placeholder="Cancellation reason" />
      <Button className="w-full" type="submit" variant="secondary">Cancel Booking</Button>
    </form>
  );
}

export function ClassAttendanceForm({ booking }: { booking: ClassBookingRow }) {
  const [state, formAction] = useActionState(recordClassAttendanceAction, initialAuthActionState);
  return (
    <form action={formAction} className="grid gap-2 md:grid-cols-[1fr_auto]">
      <FormMessage state={state} />
      <input name="sessionId" suppressHydrationWarning type="hidden" value={booking.session_id} />
      <input name="bookingId" suppressHydrationWarning type="hidden" value={booking.id} />
      <input name="memberId" suppressHydrationWarning type="hidden" value={booking.member_id} />
      <select className={selectClass} name="status" defaultValue="attended" aria-label="Attendance status">
        <option value="attended">Attended</option>
        <option value="late">Late</option>
        <option value="absent">Absent</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <input name="method" suppressHydrationWarning type="hidden" value="trainer" />
      <Button type="submit" variant="secondary">Mark</Button>
    </form>
  );
}

export function ClassSessionStatusForm({ session }: { session: ClassSessionWithClass }) {
  const [state, formAction] = useActionState(updateClassSessionStatusAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="sessionId" suppressHydrationWarning type="hidden" value={session.id} />
      <select className={selectClass} name="nextStatus" defaultValue={session.status} aria-label="Session status">
        <option value="scheduled">Scheduled</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
        <option value="closed">Closed</option>
      </select>
      <Input name="reason" placeholder="Reason or notes" />
      <Button className="w-full" type="submit" variant="secondary">Update Session</Button>
    </form>
  );
}

function Field({ id, label, name, state, children }: { id?: string; label: string; name: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={id ?? name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function HiddenInput({ name, value }: { name: string; value: string }) {
  return <input name={name} suppressHydrationWarning type="hidden" value={value} />;
}

export function ClassDeleteForm({ classId }: { classId: string }) {
  const [state, formAction] = useActionState(deleteClassAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="classId" value={classId} />
      <p className="text-sm font-semibold text-destructive">This will permanently delete the class and all associated sessions.</p>
      <AuthSubmitButton>Delete Class</AuthSubmitButton>
    </form>
  );
}
