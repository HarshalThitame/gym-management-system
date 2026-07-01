"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { MemberRow } from "@/types/membership";
import type {
  MemberPtPackageRow,
  PersonalTrainingPackageRow,
  StaffProfileRow,
  TrainerAssignmentRow,
  TrainerProfileRow,
  TrainerRow,
  TrainerSessionRow,
  WorkoutProgramRow
} from "@/types/training";
import { formatDateInput } from "../lib/business-rules";
import {
  addTrainerSpecializationAction,
  addWorkoutExerciseAction,
  archiveStaffAction,
  archiveTrainerAction,
  assignTrainerAction,
  assignWorkoutProgramAction,
  deletePtPackageAction,
  endTrainerAssignmentAction,
  purchasePtPackageAction,
  saveAvailabilityAction,
  saveCertificationAction,
  savePtPackageAction,
  saveStaffProfileAction,
  saveTrainerAction,
  saveTrainerNoteAction,
  saveTrainerSessionAction,
  saveWorkoutProgramAction,
  submitTrainerFeedbackAction,
  updateTrainerSessionStatusAction
} from "../actions/training-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function TrainerForm({ trainer, profile }: { trainer?: TrainerRow | null; profile?: TrainerProfileRow | null }) {
  const [state, formAction] = useActionState(saveTrainerAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="trainerId" value={trainer?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="displayName" label="Display name" state={state}>
          <Input id="displayName" name="displayName" defaultValue={trainer?.display_name ?? ""} required />
        </Field>
        <Field name="userId" label="Linked user ID" state={state}>
          <Input id="userId" name="userId" defaultValue={trainer?.user_id ?? ""} placeholder="Optional Supabase user UUID" />
        </Field>
        <Field name="email" label="Email" state={state}>
          <Input id="email" name="email" type="email" defaultValue={trainer?.email ?? ""} />
        </Field>
        <Field name="phone" label="Phone" state={state}>
          <Input id="phone" name="phone" type="tel" defaultValue={trainer?.phone ?? ""} />
        </Field>
        <Field name="yearsExperience" label="Years experience" state={state}>
          <Input id="yearsExperience" min={0} name="yearsExperience" type="number" defaultValue={trainer?.years_experience ?? 3} />
        </Field>
        <Field name="hourlyRateAmount" label="Hourly rate" state={state}>
          <Input id="hourlyRateAmount" min={0} name="hourlyRateAmount" step="0.01" type="number" defaultValue={moneyInputValue(trainer?.hourly_rate_amount)} />
        </Field>
        <Field name="employmentType" label="Employment type" state={state}>
          <select className={selectClass} id="employmentType" name="employmentType" defaultValue={trainer?.employment_type ?? "full_time"}>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contract">Contract</option>
            <option value="consultant">Consultant</option>
          </select>
        </Field>
        <Field name="status" label="Status" state={state}>
          <select className={selectClass} id="status" name="status" defaultValue={trainer?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On leave</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <Field name="joinedAt" label="Joined date" state={state}>
          <Input id="joinedAt" name="joinedAt" type="date" defaultValue={trainer?.joined_at ?? formatDateInput(new Date())} />
        </Field>
        <Field name="headline" label="Headline" state={state}>
          <Input id="headline" name="headline" defaultValue={profile?.headline ?? "Performance Coach"} />
        </Field>
      </div>
      <Field name="bio" label="Bio" state={state}>
        <Textarea id="bio" name="bio" defaultValue={profile?.bio ?? ""} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="achievements" label="Achievements" state={state}>
          <Textarea id="achievements" name="achievements" defaultValue={profile?.achievements ?? ""} />
        </Field>
        <Field name="coachingPhilosophy" label="Coaching philosophy" state={state}>
          <Textarea id="coachingPhilosophy" name="coachingPhilosophy" defaultValue={profile?.coaching_philosophy ?? ""} />
        </Field>
      </div>
      <Field name="instagramUrl" label="Instagram URL" state={state}>
        <Input id="instagramUrl" name="instagramUrl" defaultValue={profile?.instagram_url ?? ""} />
      </Field>
      <label className="flex items-center gap-3 text-sm font-bold">
        <input className="size-4 accent-primary" name="publicVisible" type="checkbox" defaultChecked={profile?.public_visible ?? true} />
        Show trainer in public/profile surfaces
      </label>
      <AuthSubmitButton>{trainer ? "Update Trainer" : "Create Trainer"}</AuthSubmitButton>
    </form>
  );
}

export function TrainerSpecializationForm({ trainerId }: { trainerId: string }) {
  const [state, formAction] = useActionState(addTrainerSpecializationAction, initialAuthActionState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
      <FormMessage state={state} />
      <HiddenInput name="trainerId" value={trainerId} />
      <select className={selectClass} name="specialization" defaultValue="strength_training">
        <option value="weight_loss">Weight loss</option>
        <option value="muscle_building">Muscle building</option>
        <option value="strength_training">Strength training</option>
        <option value="powerlifting">Powerlifting</option>
        <option value="bodybuilding">Bodybuilding</option>
        <option value="hiit">HIIT</option>
        <option value="crossfit">CrossFit</option>
        <option value="yoga">Yoga</option>
        <option value="functional_training">Functional training</option>
        <option value="senior_fitness">Senior fitness</option>
        <option value="sports_conditioning">Sports conditioning</option>
        <option value="rehabilitation">Rehabilitation</option>
      </select>
      <select className={selectClass} name="proficiency" defaultValue="advanced">
        <option value="primary">Primary</option>
        <option value="advanced">Advanced</option>
        <option value="specialist">Specialist</option>
      </select>
      <AuthSubmitButton>Add</AuthSubmitButton>
    </form>
  );
}

export function CertificationForm({ trainerId }: { trainerId: string }) {
  const [state, formAction] = useActionState(saveCertificationAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="trainerId" value={trainerId} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="certificationName" label="Certification" state={state}>
          <Input id="certificationName" name="certificationName" placeholder="ACE Personal Trainer" />
        </Field>
        <Field name="issuingOrganization" label="Issuing organization" state={state}>
          <Input id="issuingOrganization" name="issuingOrganization" placeholder="ACE, NASM, ISSA" />
        </Field>
        <Input name="issueDate" type="date" aria-label="Issue date" />
        <Input name="expiryDate" type="date" aria-label="Expiry date" />
        <select className={selectClass} name="status" defaultValue="active" aria-label="Certification status">
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="archived">Archived</option>
        </select>
        <Input accept="image/jpeg,image/png,image/webp,application/pdf" name="certificateFile" type="file" aria-label="Certificate file" />
      </div>
      <AuthSubmitButton>Save Certification</AuthSubmitButton>
    </form>
  );
}

export function AvailabilityForm({ trainerId }: { trainerId: string }) {
  const [state, formAction] = useActionState(saveAvailabilityAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="trainerId" value={trainerId} />
      <div className="grid gap-4 md:grid-cols-5">
        <select className={selectClass} name="dayOfWeek" defaultValue="1" aria-label="Day of week">
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
        <Input name="startsAt" type="time" defaultValue="07:00" aria-label="Start time" />
        <Input name="endsAt" type="time" defaultValue="13:00" aria-label="End time" />
        <Input name="breakStartsAt" type="time" aria-label="Break start" />
        <Input name="breakEndsAt" type="time" aria-label="Break end" />
      </div>
      <label className="flex items-center gap-3 text-sm font-bold">
        <input className="size-4 accent-primary" name="isActive" type="checkbox" defaultChecked />
        Availability active
      </label>
      <AuthSubmitButton>Save Availability</AuthSubmitButton>
    </form>
  );
}

export function TrainerAssignmentForm({ trainers, members, defaultTrainerId = "", defaultMemberId = "" }: { trainers: TrainerRow[]; members: MemberRow[]; defaultTrainerId?: string; defaultMemberId?: string }) {
  const [state, formAction] = useActionState(assignTrainerAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectTrainer trainers={trainers} defaultTrainerId={defaultTrainerId} />
        <SelectMember members={members} defaultMemberId={defaultMemberId} />
        <select className={selectClass} name="assignmentType" defaultValue="primary" aria-label="Assignment type">
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="personal_training">Personal training</option>
        </select>
      </div>
      <Textarea name="reason" placeholder="Assignment reason or coaching context" />
      <AuthSubmitButton>Assign Trainer</AuthSubmitButton>
    </form>
  );
}

export function EndAssignmentForm({ assignment }: { assignment: TrainerAssignmentRow }) {
  const [state, formAction] = useActionState(endTrainerAssignmentAction, initialAuthActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <FormMessage state={state} />
      <HiddenInput name="assignmentId" value={assignment.id} />
      <HiddenInput name="memberId" value={assignment.member_id} />
      <Input className="min-w-56" name="reason" placeholder="Reason" required />
      <Button type="submit" variant="destructive">End</Button>
    </form>
  );
}

export function PtPackageForm({ packageRow }: { packageRow?: PersonalTrainingPackageRow | null }) {
  const [state, formAction] = useActionState(savePtPackageAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="packageId" value={packageRow?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="name" label="Package name" state={state}>
          <Input id="name" name="name" defaultValue={packageRow?.name ?? ""} />
        </Field>
        <Field name="priceAmount" label="Price" state={state}>
          <Input id="priceAmount" min={0} name="priceAmount" step="0.01" type="number" defaultValue={moneyInputValue(packageRow?.price_amount)} />
        </Field>
        <Field name="sessionCount" label="Sessions" state={state}>
          <Input id="sessionCount" min={1} name="sessionCount" type="number" defaultValue={packageRow?.session_count ?? 8} />
        </Field>
        <Field name="validityDays" label="Validity days" state={state}>
          <Input id="validityDays" min={1} name="validityDays" type="number" defaultValue={packageRow?.validity_days ?? 60} />
        </Field>
        <select className={selectClass} name="status" defaultValue={packageRow?.status ?? "active"} aria-label="Package status">
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <Input name="displayOrder" type="number" defaultValue={packageRow?.display_order ?? 100} aria-label="Display order" />
      </div>
      <Field name="description" label="Description" state={state}>
        <Textarea id="description" name="description" defaultValue={packageRow?.description ?? ""} />
      </Field>
      <label className="flex items-center gap-3 text-sm font-bold">
        <input className="size-4 accent-primary" name="isPublic" type="checkbox" defaultChecked={packageRow?.is_public ?? true} />
        Publicly visible
      </label>
      <AuthSubmitButton>{packageRow ? "Update Package" : "Create Package"}</AuthSubmitButton>
    </form>
  );
}

export function PtPurchaseForm({ packages, members, trainers }: { packages: PersonalTrainingPackageRow[]; members: MemberRow[]; trainers: TrainerRow[] }) {
  const [state, formAction] = useActionState(purchasePtPackageAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectMember members={members} />
        <select className={selectClass} name="packageId" defaultValue={packages[0]?.id ?? ""} aria-label="PT package">
          {packages.map((packageRow) => (
            <option key={packageRow.id} value={packageRow.id}>{packageRow.name}</option>
          ))}
        </select>
        <SelectTrainer trainers={trainers} />
        <Input name="startsOn" type="date" defaultValue={formatDateInput(new Date())} aria-label="Package start date" />
        <select className={selectClass} name="paymentStatus" defaultValue="pending_payment" aria-label="Payment status">
          <option value="pending_payment">Pending payment</option>
          <option value="active">Paid and active</option>
        </select>
      </div>
      <AuthSubmitButton>Assign PT Package</AuthSubmitButton>
    </form>
  );
}

export function TrainerSessionForm({
  trainers,
  members,
  packages = [],
  programs = [],
  defaultTrainerId = "",
  defaultMemberId = ""
}: {
  trainers: TrainerRow[];
  members: MemberRow[];
  packages?: MemberPtPackageRow[];
  programs?: WorkoutProgramRow[];
  defaultTrainerId?: string;
  defaultMemberId?: string;
}) {
  const [state, formAction] = useActionState(saveTrainerSessionAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectTrainer trainers={trainers} defaultTrainerId={defaultTrainerId} />
        <SelectMember members={members} defaultMemberId={defaultMemberId} />
        <Input name="sessionDate" type="date" defaultValue={formatDateInput(new Date())} aria-label="Session date" />
        <div className="grid grid-cols-2 gap-3">
          <Input name="startsAt" type="time" defaultValue="07:00" aria-label="Session start" />
          <Input name="endsAt" type="time" defaultValue="08:00" aria-label="Session end" />
        </div>
        <Input name="workoutType" defaultValue="Strength coaching" aria-label="Workout type" />
        <select className={selectClass} name="memberPtPackageId" defaultValue="" aria-label="PT package">
          <option value="">No PT package</option>
          {packages.map((packageRow) => (
            <option key={packageRow.id} value={packageRow.id}>{packageRow.status} · {packageRow.remaining_sessions} left</option>
          ))}
        </select>
        <select className={selectClass} name="workoutProgramId" defaultValue="" aria-label="Workout program">
          <option value="">No workout program</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>{program.name}</option>
          ))}
        </select>
      </div>
      <Textarea name="notes" placeholder="Session focus, constraints, or preparation notes" />
      <AuthSubmitButton>Schedule Session</AuthSubmitButton>
    </form>
  );
}

export function TrainerSessionStatusForm({ session }: { session: TrainerSessionRow }) {
  const [state, formAction] = useActionState(updateTrainerSessionStatusAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="sessionId" value={session.id} />
      <select className={selectClass} name="nextStatus" defaultValue="completed" aria-label="Next session status">
        <option value="completed">Complete</option>
        <option value="missed">Missed</option>
        <option value="cancelled">Cancel</option>
        <option value="rescheduled">Reschedule required</option>
      </select>
      <Textarea name="completionNotes" placeholder="Completion notes" />
      <Input name="reason" placeholder="Reason if missed, cancelled, or rescheduled" />
      <AuthSubmitButton>Update Session</AuthSubmitButton>
    </form>
  );
}

export function WorkoutProgramForm({ trainers, members, defaultTrainerId = "", defaultMemberId = "" }: { trainers: TrainerRow[]; members: MemberRow[]; defaultTrainerId?: string; defaultMemberId?: string }) {
  const [state, formAction] = useActionState(saveWorkoutProgramAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectTrainer trainers={trainers} defaultTrainerId={defaultTrainerId} />
        <SelectMember members={members} defaultMemberId={defaultMemberId} includeEmpty />
        <Input name="name" placeholder="12-week strength base" aria-label="Program name" />
        <Input name="goal" placeholder="Build strength, improve movement quality" aria-label="Program goal" />
        <select className={selectClass} name="difficulty" defaultValue="intermediate" aria-label="Difficulty">
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="elite">Elite</option>
        </select>
        <Input name="durationWeeks" type="number" min={1} defaultValue={4} aria-label="Duration weeks" />
        <select className={selectClass} name="status" defaultValue="active" aria-label="Program status">
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <Textarea name="description" placeholder="Program structure and coaching notes" />
      <AuthSubmitButton>Create Program</AuthSubmitButton>
    </form>
  );
}

export function WorkoutExerciseForm({ programId }: { programId: string }) {
  const [state, formAction] = useActionState(addWorkoutExerciseAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="programId" value={programId} />
      <div className="grid gap-3 md:grid-cols-3">
        <Input name="dayNumber" type="number" min={1} max={14} defaultValue={1} aria-label="Day number" />
        <Input name="exerciseName" placeholder="Back squat" aria-label="Exercise name" />
        <Input name="category" placeholder="Strength" aria-label="Exercise category" />
        <Input name="sets" defaultValue="4" aria-label="Sets" />
        <Input name="reps" defaultValue="6" aria-label="Reps" />
        <Input name="restSeconds" type="number" min={0} defaultValue={120} aria-label="Rest seconds" />
        <Input name="tempo" placeholder="3-1-1" aria-label="Tempo" />
        <Input name="displayOrder" type="number" defaultValue={100} aria-label="Display order" />
      </div>
      <Textarea name="instructions" placeholder="Technical cues and progression notes" />
      <AuthSubmitButton>Add Exercise</AuthSubmitButton>
    </form>
  );
}

export function WorkoutAssignmentForm({ programs, trainers, members }: { programs: WorkoutProgramRow[]; trainers: TrainerRow[]; members: MemberRow[] }) {
  const [state, formAction] = useActionState(assignWorkoutProgramAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <select className={selectClass} name="programId" defaultValue={programs[0]?.id ?? ""} aria-label="Workout program">
          {programs.map((program) => (
            <option key={program.id} value={program.id}>{program.name}</option>
          ))}
        </select>
        <SelectTrainer trainers={trainers} defaultTrainerId={programs[0]?.trainer_id ?? ""} />
        <SelectMember members={members} />
        <Input name="startsOn" type="date" defaultValue={formatDateInput(new Date())} aria-label="Starts on" />
        <Input name="endsOn" type="date" aria-label="Ends on" />
      </div>
      <AuthSubmitButton>Assign Program</AuthSubmitButton>
    </form>
  );
}

export function TrainerNoteForm({ trainers, members, defaultTrainerId = "", defaultMemberId = "" }: { trainers: TrainerRow[]; members: MemberRow[]; defaultTrainerId?: string; defaultMemberId?: string }) {
  const [state, formAction] = useActionState(saveTrainerNoteAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectTrainer trainers={trainers} defaultTrainerId={defaultTrainerId} />
        <SelectMember members={members} defaultMemberId={defaultMemberId} />
        <select className={selectClass} name="noteType" defaultValue="progress" aria-label="Note type">
          <option value="progress">Progress</option>
          <option value="recommendation">Recommendation</option>
          <option value="observation">Observation</option>
          <option value="injury">Injury</option>
          <option value="goal">Goal</option>
          <option value="private">Private</option>
        </select>
        <select className={selectClass} name="visibility" defaultValue="staff" aria-label="Visibility">
          <option value="trainer_only">Trainer only</option>
          <option value="staff">Staff</option>
          <option value="trainer_and_member">Trainer and member</option>
        </select>
      </div>
      <Input name="title" placeholder="Progress note title" />
      <Textarea name="body" placeholder="Observations, goals, injuries, or recommendations" />
      <AuthSubmitButton>Save Note</AuthSubmitButton>
    </form>
  );
}

export function TrainerFeedbackForm({ trainerId, memberId, sessionId = "" }: { trainerId: string; memberId: string; sessionId?: string }) {
  const [state, formAction] = useActionState(submitTrainerFeedbackAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border bg-surface p-5">
      <FormMessage state={state} />
      <HiddenInput name="trainerId" value={trainerId} />
      <HiddenInput name="memberId" value={memberId} />
      <HiddenInput name="sessionId" value={sessionId} />
      <select className={selectClass} name="rating" defaultValue="5" aria-label="Rating">
        <option value="5">5 stars</option>
        <option value="4">4 stars</option>
        <option value="3">3 stars</option>
        <option value="2">2 stars</option>
        <option value="1">1 star</option>
      </select>
      <Textarea name="feedback" placeholder="Share feedback about your coaching session" />
      <label className="flex items-center gap-3 text-sm font-bold">
        <input className="size-4 accent-primary" name="isPublic" type="checkbox" />
        Allow gym team to use this review publicly
      </label>
      <AuthSubmitButton>Submit Feedback</AuthSubmitButton>
    </form>
  );
}

export function StaffProfileForm({ staff }: { staff?: StaffProfileRow | null }) {
  const [state, formAction] = useActionState(saveStaffProfileAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="staffId" value={staff?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="fullName" label="Full name" state={state}>
          <Input id="fullName" name="fullName" defaultValue={staff?.full_name ?? ""} />
        </Field>
        <Field name="userId" label="Linked user ID" state={state}>
          <Input id="userId" name="userId" defaultValue={staff?.user_id ?? ""} />
        </Field>
        <Input name="email" type="email" defaultValue={staff?.email ?? ""} placeholder="Email" />
        <Input name="phone" type="tel" defaultValue={staff?.phone ?? ""} placeholder="Phone" />
        <select className={selectClass} name="staffRole" defaultValue={staff?.staff_role ?? "reception"} aria-label="Staff role">
          <option value="manager">Manager</option>
          <option value="reception">Reception</option>
          <option value="support">Support</option>
          <option value="admin">Admin</option>
        </select>
        <select className={selectClass} name="status" defaultValue={staff?.status ?? "active"} aria-label="Staff status">
          <option value="active">Active</option>
          <option value="on_leave">On leave</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>
        <select className={selectClass} name="employmentType" defaultValue={staff?.employment_type ?? "full_time"} aria-label="Employment type">
          <option value="full_time">Full time</option>
          <option value="part_time">Part time</option>
          <option value="contract">Contract</option>
        </select>
        <Input name="joinedAt" type="date" defaultValue={staff?.joined_at ?? formatDateInput(new Date())} aria-label="Joined date" />
      </div>
      <AuthSubmitButton>{staff ? "Update Staff" : "Create Staff"}</AuthSubmitButton>
    </form>
  );
}

function SelectTrainer({ trainers, defaultTrainerId = "" }: { trainers: TrainerRow[]; defaultTrainerId?: string }) {
  return (
    <select className={selectClass} name="trainerId" defaultValue={defaultTrainerId || (trainers[0]?.id ?? "")} aria-label="Trainer">
      {trainers.map((trainer) => (
        <option key={trainer.id} value={trainer.id}>{trainer.display_name}</option>
      ))}
    </select>
  );
}

function SelectMember({ members, defaultMemberId = "", includeEmpty = false }: { members: MemberRow[]; defaultMemberId?: string; includeEmpty?: boolean }) {
  return (
    <select className={selectClass} name="memberId" defaultValue={defaultMemberId || (includeEmpty ? "" : (members[0]?.id ?? ""))} aria-label="Member">
      {includeEmpty ? <option value="">Template program</option> : null}
      {members.map((member) => (
        <option key={member.id} value={member.id}>{member.full_name} · {member.member_code}</option>
      ))}
    </select>
  );
}

function Field({ name, label, state, children }: { name: string; label: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function HiddenInput({ name, value }: { name: string; value: string }) {
  return <input name={name} suppressHydrationWarning type="hidden" value={value} />;
}

function moneyInputValue(value?: number | null) {
  return value ? value / 100 : 0;
}

export function StaffArchiveForm({ staffId }: { staffId: string }) {
  const [state, formAction] = useActionState(archiveStaffAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="staffId" value={staffId} />
      <p className="text-sm font-semibold text-destructive">This will archive the staff profile and revoke access.</p>
      <AuthSubmitButton>Archive Staff</AuthSubmitButton>
    </form>
  );
}

export function PtPackageDeleteForm({ packageId }: { packageId: string }) {
  const [state, formAction] = useActionState(deletePtPackageAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="packageId" value={packageId} />
      <p className="text-sm font-semibold text-destructive">This will permanently delete the PT package.</p>
      <AuthSubmitButton>Delete Package</AuthSubmitButton>
    </form>
  );
}

export function TrainerArchiveForm({ trainerId }: { trainerId: string }) {
  const [state, formAction] = useActionState(archiveTrainerAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="trainerId" value={trainerId} />
      <p className="text-sm font-semibold text-destructive">This will archive the trainer and end all active member assignments.</p>
      <AuthSubmitButton>Archive Trainer</AuthSubmitButton>
    </form>
  );
}
